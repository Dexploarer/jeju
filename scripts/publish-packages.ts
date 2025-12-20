#!/usr/bin/env bun
/**
 * Local package publish test script
 * Builds all packages in dependency order and tests npm pack
 * 
 * Usage:
 *   bun scripts/publish-packages.ts           # dry-run (default)
 *   bun scripts/publish-packages.ts --publish # actually publish to npm
 */

import { $ } from 'bun';
import { existsSync } from 'fs';
import { join } from 'path';

const PACKAGES_DIR = join(import.meta.dir, '../packages');

// Packages in dependency order (dependencies must come before dependents)
const PACKAGES = [
  'types',      // No deps
  'config',     // No deps  
  'contracts',  // No deps
  'oauth3',     // No internal deps
  'kms',        // Depends on oauth3
  'db',         // Depends on config
  'messaging',  // No internal deps
  'shared',     // Depends on db, kms, config
  'sdk',        // Depends on types, config
  'ui',         // Depends on sdk, types
  'bots',       // Depends on config, contracts, types
  'farcaster',  // No internal deps
  'cli',        // Depends on config, contracts, types (optional peer deps)
  'tests',      // Depends on kms, shared
] as const;

interface PackageResult {
  name: string;
  success: boolean;
  error?: string;
  tarball?: string;
}

async function buildPackage(pkg: string): Promise<PackageResult> {
  const pkgPath = join(PACKAGES_DIR, pkg);
  const pkgJsonPath = join(pkgPath, 'package.json');
  
  if (!existsSync(pkgJsonPath)) {
    return { name: pkg, success: false, error: 'package.json not found' };
  }
  
  const pkgJson = await Bun.file(pkgJsonPath).json();
  
  // Skip private packages
  if (pkgJson.private) {
    console.log(`  ⏭️  ${pkg} (private, skipping)`);
    return { name: pkg, success: true };
  }
  
  console.log(`\n📦 Building ${pkgJson.name}...`);
  
  // Build if script exists
  if (pkgJson.scripts?.build) {
    const buildResult = await $`cd ${pkgPath} && bun run build`.quiet().nothrow();
    if (buildResult.exitCode !== 0) {
      console.log(`  ❌ Build failed`);
      console.log(buildResult.stderr.toString());
      return { name: pkg, success: false, error: 'Build failed' };
    }
    console.log(`  ✅ Build succeeded`);
  }
  
  return { name: pkg, success: true };
}

async function packPackage(pkg: string, dryRun: boolean): Promise<PackageResult> {
  const pkgPath = join(PACKAGES_DIR, pkg);
  const pkgJsonPath = join(pkgPath, 'package.json');
  
  if (!existsSync(pkgJsonPath)) {
    return { name: pkg, success: false, error: 'package.json not found' };
  }
  
  const pkgJson = await Bun.file(pkgJsonPath).json();
  
  if (pkgJson.private) {
    return { name: pkg, success: true };
  }
  
  console.log(`\n📦 Packing ${pkgJson.name}...`);
  
  // Run npm pack
  const packResult = dryRun 
    ? await $`cd ${pkgPath} && npm pack --dry-run`.quiet().nothrow()
    : await $`cd ${pkgPath} && npm pack`.quiet().nothrow();
  
  if (packResult.exitCode !== 0) {
    console.log(`  ❌ Pack failed`);
    console.log(packResult.stderr.toString());
    return { name: pkg, success: false, error: 'Pack failed' };
  }
  
  console.log(`  ✅ Pack succeeded`);
  
  // Get tarball info
  const output = packResult.stdout.toString().trim();
  const lines = output.split('\n');
  const tarball = lines[lines.length - 1];
  
  return { name: pkg, success: true, tarball };
}

async function publishPackage(pkg: string): Promise<PackageResult> {
  const pkgPath = join(PACKAGES_DIR, pkg);
  const pkgJsonPath = join(pkgPath, 'package.json');
  
  if (!existsSync(pkgJsonPath)) {
    return { name: pkg, success: false, error: 'package.json not found' };
  }
  
  const pkgJson = await Bun.file(pkgJsonPath).json();
  
  if (pkgJson.private) {
    return { name: pkg, success: true };
  }
  
  console.log(`\n🚀 Publishing ${pkgJson.name}@${pkgJson.version}...`);
  
  const publishResult = await $`cd ${pkgPath} && npm publish --access public`.quiet().nothrow();
  
  if (publishResult.exitCode !== 0) {
    const stderr = publishResult.stderr.toString();
    // Check if it's just "already exists" error
    if (stderr.includes('You cannot publish over the previously published versions')) {
      console.log(`  ⏭️  Already published at this version`);
      return { name: pkg, success: true };
    }
    console.log(`  ❌ Publish failed`);
    console.log(stderr);
    return { name: pkg, success: false, error: 'Publish failed' };
  }
  
  console.log(`  ✅ Published successfully`);
  return { name: pkg, success: true };
}

async function main() {
  const args = process.argv.slice(2);
  const shouldPublish = args.includes('--publish');
  const dryRun = !shouldPublish;
  
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           Jeju Network Package Publisher                  ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Mode: ${dryRun ? 'DRY RUN (use --publish to publish)' : 'PUBLISHING TO NPM'}${dryRun ? '       ' : '                '} ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Build all packages first
  console.log('\n═══ BUILDING PACKAGES ═══');
  const buildResults: PackageResult[] = [];
  
  for (const pkg of PACKAGES) {
    const result = await buildPackage(pkg);
    buildResults.push(result);
    if (!result.success) {
      console.log(`\n❌ Build failed for ${pkg}, stopping.`);
      process.exit(1);
    }
  }
  
  // Pack all packages
  console.log('\n═══ PACKING PACKAGES ═══');
  const packResults: PackageResult[] = [];
  
  for (const pkg of PACKAGES) {
    const result = await packPackage(pkg, dryRun);
    packResults.push(result);
    if (!result.success) {
      console.log(`\n❌ Pack failed for ${pkg}`);
    }
  }
  
  // Publish if not dry run
  if (!dryRun) {
    console.log('\n═══ PUBLISHING PACKAGES ═══');
    
    for (const pkg of PACKAGES) {
      const result = await publishPackage(pkg);
      if (!result.success) {
        console.log(`\n❌ Publish failed for ${pkg}`);
      }
    }
  }
  
  // Summary
  console.log('\n═══ SUMMARY ═══');
  const successful = packResults.filter(r => r.success);
  const failed = packResults.filter(r => !r.success);
  
  console.log(`✅ ${successful.length} packages ready`);
  if (failed.length > 0) {
    console.log(`❌ ${failed.length} packages failed:`);
    failed.forEach(r => console.log(`   - ${r.name}: ${r.error}`));
  }
  
  if (dryRun) {
    console.log('\n💡 Run with --publish to publish to npm');
  }
}

main().catch(console.error);
