#!/usr/bin/env bun
/**
 * Full Testnet Deployment Orchestrator
 * 
 * Orchestrates the complete deployment of Jeju to testnet:
 * 1. Deploy infrastructure contracts
 * 2. Deploy DWS to Kubernetes
 * 3. Build and push container images
 * 4. Build and upload frontends
 * 5. Publish packages
 * 6. Register JNS names
 * 7. Push Jeju repo to JejuGit
 * 8. Verify deployment
 */

import { join } from 'path';
import { execSync, spawn } from 'child_process';

// ============================================================================
// Configuration
// ============================================================================

interface DeploymentPhase {
  name: string;
  description: string;
  script: string;
  optional?: boolean;
  requiresK8s?: boolean;
  requiresDocker?: boolean;
}

const ROOT_DIR = join(import.meta.dir, '../..');

const PHASES: DeploymentPhase[] = [
  {
    name: 'contracts',
    description: 'Deploy infrastructure contracts to Base Sepolia',
    script: 'scripts/deploy/testnet-dws-infrastructure.ts',
  },
  {
    name: 'k8s',
    description: 'Deploy DWS to Kubernetes',
    script: 'deploy:k8s',
    requiresK8s: true,
  },
  {
    name: 'containers',
    description: 'Build and push container images',
    script: 'deploy:containers',
    requiresDocker: true,
  },
  {
    name: 'frontends',
    description: 'Build and upload frontends to DWS storage',
    script: 'scripts/deploy/upload-frontends.ts',
  },
  {
    name: 'packages',
    description: 'Publish packages to JejuPkg',
    script: 'deploy:packages',
    optional: true,
  },
  {
    name: 'jns',
    description: 'Register JNS names',
    script: 'scripts/deploy/register-jns.ts',
  },
  {
    name: 'self-host',
    description: 'Push Jeju to its own infrastructure',
    script: 'scripts/deploy/self-host-bootstrap.ts',
    optional: true,
  },
  {
    name: 'verify',
    description: 'Verify deployment',
    script: 'scripts/deploy/verify-testnet.ts',
  },
];

// ============================================================================
// Orchestrator Class
// ============================================================================

class TestnetDeploymentOrchestrator {
  private startTime: number;
  private phaseResults: Map<string, { success: boolean; duration: number; error?: string }> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  async run(startFromPhase?: string, skipPhases?: string[]): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║          JEJU TESTNET FULL DEPLOYMENT                                ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Started: ${new Date().toISOString()}`);
    console.log('');

    // Pre-flight checks
    await this.preFlightChecks();

    // Find starting phase
    let startIndex = 0;
    if (startFromPhase) {
      const idx = PHASES.findIndex(p => p.name === startFromPhase);
      if (idx >= 0) {
        startIndex = idx;
        console.log(`Starting from phase: ${startFromPhase}`);
      }
    }

    // Run phases
    for (let i = startIndex; i < PHASES.length; i++) {
      const phase = PHASES[i];

      if (skipPhases?.includes(phase.name)) {
        console.log(`⏭️  Skipping phase: ${phase.name}`);
        this.phaseResults.set(phase.name, { success: true, duration: 0 });
        continue;
      }

      console.log('');
      console.log('═══════════════════════════════════════════════════════════════════════');
      console.log(`PHASE ${i + 1}/${PHASES.length}: ${phase.name.toUpperCase()}`);
      console.log(`${phase.description}`);
      console.log('═══════════════════════════════════════════════════════════════════════');
      console.log('');

      const phaseStart = Date.now();

      const success = await this.runPhase(phase);
      const duration = Date.now() - phaseStart;

      this.phaseResults.set(phase.name, { success, duration });

      if (!success && !phase.optional) {
        console.error(`Phase ${phase.name} failed. Stopping deployment.`);
        break;
      }
    }

    // Print summary
    this.printSummary();
  }

  private async preFlightChecks(): Promise<void> {
    console.log('Pre-flight Checks:');

    // Check environment variables
    const requiredEnvVars = ['DEPLOYER_PRIVATE_KEY'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.error(`  ❌ Missing ${envVar}`);
        throw new Error(`Required environment variable ${envVar} not set`);
      }
      console.log(`  ✅ ${envVar} set`);
    }

    // Check tools
    const tools = [
      { name: 'bun', cmd: 'bun --version' },
      { name: 'forge', cmd: 'forge --version' },
    ];

    for (const tool of tools) {
      try {
        execSync(tool.cmd, { stdio: 'pipe' });
        console.log(`  ✅ ${tool.name} installed`);
      } catch {
        console.error(`  ❌ ${tool.name} not found`);
        throw new Error(`Required tool ${tool.name} not installed`);
      }
    }

    // Check optional tools
    const optionalTools = [
      { name: 'kubectl', cmd: 'kubectl version --client' },
      { name: 'helm', cmd: 'helm version' },
      { name: 'docker', cmd: 'docker version' },
    ];

    for (const tool of optionalTools) {
      try {
        execSync(tool.cmd, { stdio: 'pipe' });
        console.log(`  ✅ ${tool.name} installed`);
      } catch {
        console.log(`  ⚠️  ${tool.name} not found (optional)`);
      }
    }

    console.log('');
  }

  private async runPhase(phase: DeploymentPhase): Promise<boolean> {
    // Check prerequisites
    if (phase.requiresK8s) {
      try {
        execSync('kubectl cluster-info', { stdio: 'pipe' });
      } catch {
        console.log('⏭️  Skipping K8s phase - no cluster available');
        return true;
      }
    }

    if (phase.requiresDocker) {
      try {
        execSync('docker info', { stdio: 'pipe' });
      } catch {
        console.log('⏭️  Skipping Docker phase - Docker not available');
        return true;
      }
    }

    // Run the phase script
    if (phase.script.startsWith('scripts/')) {
      // Run as bun script
      return this.runScript(join(ROOT_DIR, phase.script), ['testnet']);
    } else if (phase.script.startsWith('deploy:')) {
      // Run as npm/bun command
      return this.runCommand(`bun run ${phase.script}`);
    }

    return false;
  }

  private runScript(scriptPath: string, args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('bun', ['run', scriptPath, ...args], {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: '1' },
      });

      child.on('exit', (code) => {
        resolve(code === 0);
      });

      child.on('error', () => {
        resolve(false);
      });
    });
  }

  private runCommand(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', cmd], {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: '1' },
      });

      child.on('exit', (code) => {
        resolve(code === 0);
      });

      child.on('error', () => {
        resolve(false);
      });
    });
  }

  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime;

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                    DEPLOYMENT SUMMARY                                ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('');

    console.log('Phase Results:');
    let allSuccess = true;
    for (const [name, result] of this.phaseResults) {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration > 0 ? ` (${(result.duration / 1000).toFixed(1)}s)` : '';
      console.log(`  ${status} ${name}${duration}`);
      if (!result.success) allSuccess = false;
    }
    console.log('');

    console.log(`Total Duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
    console.log('');

    if (allSuccess) {
      console.log('🎉 DEPLOYMENT COMPLETE');
      console.log('');
      console.log('Your Jeju testnet is now fully deployed and self-hosted.');
      console.log('');
      console.log('Access Points:');
      console.log('  DWS:      https://dws.testnet.jejunetwork.org');
      console.log('  Git:      https://git.testnet.jejunetwork.org');
      console.log('  NPM:      https://npm.testnet.jejunetwork.org');
      console.log('  Models:   https://hub.testnet.jejunetwork.org');
      console.log('  Registry: https://registry.testnet.jejunetwork.org');
      console.log('  Gateway:  https://gateway.testnet.jejunetwork.org');
      console.log('');
    } else {
      console.log('❌ DEPLOYMENT INCOMPLETE');
      console.log('');
      console.log('Some phases failed. Review the output above and retry:');
      
      const failedPhases = Array.from(this.phaseResults.entries())
        .filter(([, r]) => !r.success)
        .map(([name]) => name);
      
      if (failedPhases.length > 0) {
        const resumeFrom = failedPhases[0];
        console.log(`  bun run scripts/deploy/deploy-testnet-full.ts --from ${resumeFrom}`);
      }
      console.log('');
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  let startFromPhase: string | undefined;
  let skipPhases: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      startFromPhase = args[i + 1];
      i++;
    } else if (args[i] === '--skip' && args[i + 1]) {
      skipPhases = args[i + 1].split(',');
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: bun run scripts/deploy/deploy-testnet-full.ts [options]');
      console.log('');
      console.log('Options:');
      console.log('  --from <phase>    Start from a specific phase');
      console.log('  --skip <phases>   Skip phases (comma-separated)');
      console.log('  --help, -h        Show this help');
      console.log('');
      console.log('Phases:');
      for (const phase of PHASES) {
        const optional = phase.optional ? ' (optional)' : '';
        console.log(`  ${phase.name.padEnd(12)} ${phase.description}${optional}`);
      }
      process.exit(0);
    }
  }

  const orchestrator = new TestnetDeploymentOrchestrator();
  await orchestrator.run(startFromPhase, skipPhases);
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});

