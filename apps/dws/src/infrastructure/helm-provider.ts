/**
 * Helm/Kubernetes Provider for DWS
 * 
 * Allows deploying Kubernetes workloads to the DWS decentralized network.
 * Translates K8s manifests to DWS resources:
 * 
 * - Deployment -> Multiple DWS workers/containers
 * - Service -> DWS ingress/routing
 * - ConfigMap -> DWS secrets/config
 * - PersistentVolume -> DWS storage
 * - Ingress -> JNS domain
 * - Job -> DWS job
 * 
 * Limitations:
 * - No direct pod scheduling (uses DWS decentralized scheduling)
 * - StatefulSets have eventual consistency
 * - DaemonSets deploy to all registered nodes
 * - Networking is abstracted via DWS routing
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Address } from 'viem';
import { validateBody, validateParams } from '../shared/validation';

// ============================================================================
// Kubernetes Manifest Types
// ============================================================================

interface KubeManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: Record<string, unknown>;
}

interface DeploymentSpec {
  replicas?: number;
  selector: { matchLabels: Record<string, string> };
  template: {
    metadata: { labels: Record<string, string> };
    spec: PodSpec;
  };
}

interface PodSpec {
  containers: ContainerSpec[];
  initContainers?: ContainerSpec[];
  volumes?: VolumeSpec[];
  nodeSelector?: Record<string, string>;
  tolerations?: Toleration[];
  affinity?: Affinity;
}

interface ContainerSpec {
  name: string;
  image: string;
  command?: string[];
  args?: string[];
  env?: EnvVar[];
  envFrom?: EnvFromSource[];
  ports?: ContainerPort[];
  resources?: ResourceRequirements;
  volumeMounts?: VolumeMount[];
  livenessProbe?: Probe;
  readinessProbe?: Probe;
}

interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: EnvVarSource;
}

interface EnvFromSource {
  configMapRef?: { name: string };
  secretRef?: { name: string };
}

interface EnvVarSource {
  configMapKeyRef?: { name: string; key: string };
  secretKeyRef?: { name: string; key: string };
}

interface ContainerPort {
  name?: string;
  containerPort: number;
  protocol?: string;
}

interface ResourceRequirements {
  requests?: { cpu?: string; memory?: string; 'nvidia.com/gpu'?: string };
  limits?: { cpu?: string; memory?: string; 'nvidia.com/gpu'?: string };
}

interface VolumeSpec {
  name: string;
  configMap?: { name: string };
  secret?: { secretName: string };
  persistentVolumeClaim?: { claimName: string };
  emptyDir?: Record<string, unknown>;
}

interface VolumeMount {
  name: string;
  mountPath: string;
  readOnly?: boolean;
}

interface Probe {
  httpGet?: { path: string; port: number };
  tcpSocket?: { port: number };
  exec?: { command: string[] };
  initialDelaySeconds?: number;
  periodSeconds?: number;
}

interface Toleration {
  key: string;
  operator: string;
  value?: string;
  effect: string;
}

interface Affinity {
  nodeAffinity?: Record<string, unknown>;
  podAffinity?: Record<string, unknown>;
  podAntiAffinity?: Record<string, unknown>;
}

// ============================================================================
// DWS Mapping
// ============================================================================

interface DWSDeployment {
  id: string;
  name: string;
  namespace: string;
  workers: DWSWorkerConfig[];
  services: DWSServiceConfig[];
  configMaps: DWSConfigMap[];
  secrets: DWSSecret[];
  storage: DWSStorage[];
  status: 'pending' | 'deploying' | 'running' | 'failed';
  createdAt: number;
}

interface DWSWorkerConfig {
  id: string;
  name: string;
  image: string;
  replicas: number;
  resources: {
    cpuMillis: number;
    memoryMb: number;
    gpuCount?: number;
  };
  env: Record<string, string>;
  ports: number[];
  healthCheck?: {
    path: string;
    port: number;
    intervalMs: number;
  };
}

interface DWSServiceConfig {
  id: string;
  name: string;
  selector: Record<string, string>;
  ports: { port: number; targetPort: number; name?: string }[];
  type: 'ClusterIP' | 'LoadBalancer' | 'NodePort';
}

interface DWSConfigMap {
  id: string;
  name: string;
  data: Record<string, string>;
}

interface DWSSecret {
  id: string;
  name: string;
  data: Record<string, string>;
}

interface DWSStorage {
  id: string;
  name: string;
  sizeGb: number;
  storageClass: string;
}

// ============================================================================
// Manifest Parser
// ============================================================================

class ManifestParser {
  private configMaps = new Map<string, DWSConfigMap>();
  private secrets = new Map<string, DWSSecret>();

  parseManifests(manifests: KubeManifest[]): DWSDeployment {
    const deployment: DWSDeployment = {
      id: `helm-${Date.now()}`,
      name: '',
      namespace: 'default',
      workers: [],
      services: [],
      configMaps: [],
      secrets: [],
      storage: [],
      status: 'pending',
      createdAt: Date.now(),
    };

    // First pass: collect ConfigMaps and Secrets
    for (const manifest of manifests) {
      if (manifest.kind === 'ConfigMap') {
        const cm = this.parseConfigMap(manifest);
        this.configMaps.set(cm.name, cm);
        deployment.configMaps.push(cm);
      } else if (manifest.kind === 'Secret') {
        const secret = this.parseSecret(manifest);
        this.secrets.set(secret.name, secret);
        deployment.secrets.push(secret);
      }
    }

    // Second pass: process workloads
    for (const manifest of manifests) {
      switch (manifest.kind) {
        case 'Deployment':
          const workers = this.parseDeployment(manifest);
          deployment.workers.push(...workers);
          if (!deployment.name) {
            deployment.name = manifest.metadata.name;
            deployment.namespace = manifest.metadata.namespace ?? 'default';
          }
          break;

        case 'Service':
          const service = this.parseService(manifest);
          deployment.services.push(service);
          break;

        case 'PersistentVolumeClaim':
          const storage = this.parsePVC(manifest);
          deployment.storage.push(storage);
          break;

        case 'Job':
        case 'CronJob':
          // Jobs are handled differently
          break;
      }
    }

    return deployment;
  }

  private parseConfigMap(manifest: KubeManifest): DWSConfigMap {
    return {
      id: `cm-${manifest.metadata.name}-${Date.now()}`,
      name: manifest.metadata.name,
      data: (manifest.spec as { data?: Record<string, string> }).data ?? {},
    };
  }

  private parseSecret(manifest: KubeManifest): DWSSecret {
    const data = (manifest.spec as { data?: Record<string, string> }).data ?? {};
    // Decode base64 values
    const decoded: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      decoded[key] = Buffer.from(value, 'base64').toString();
    }
    return {
      id: `secret-${manifest.metadata.name}-${Date.now()}`,
      name: manifest.metadata.name,
      data: decoded,
    };
  }

  private parseDeployment(manifest: KubeManifest): DWSWorkerConfig[] {
    const spec = manifest.spec as DeploymentSpec;
    const workers: DWSWorkerConfig[] = [];

    for (const container of spec.template.spec.containers) {
      const worker = this.parseContainer(
        container,
        manifest.metadata.name,
        spec.replicas ?? 1
      );
      workers.push(worker);
    }

    return workers;
  }

  private parseContainer(
    container: ContainerSpec,
    deploymentName: string,
    replicas: number
  ): DWSWorkerConfig {
    // Parse resources
    const cpuRequest = container.resources?.requests?.cpu ?? '100m';
    const memoryRequest = container.resources?.requests?.memory ?? '128Mi';
    const gpuCount = container.resources?.limits?.['nvidia.com/gpu'];

    // Build env from various sources
    const env: Record<string, string> = {};
    
    if (container.env) {
      for (const envVar of container.env) {
        if (envVar.value) {
          env[envVar.name] = envVar.value;
        } else if (envVar.valueFrom?.configMapKeyRef) {
          const cm = this.configMaps.get(envVar.valueFrom.configMapKeyRef.name);
          if (cm) {
            env[envVar.name] = cm.data[envVar.valueFrom.configMapKeyRef.key] ?? '';
          }
        } else if (envVar.valueFrom?.secretKeyRef) {
          const secret = this.secrets.get(envVar.valueFrom.secretKeyRef.name);
          if (secret) {
            env[envVar.name] = secret.data[envVar.valueFrom.secretKeyRef.key] ?? '';
          }
        }
      }
    }

    if (container.envFrom) {
      for (const source of container.envFrom) {
        if (source.configMapRef) {
          const cm = this.configMaps.get(source.configMapRef.name);
          if (cm) {
            Object.assign(env, cm.data);
          }
        }
        if (source.secretRef) {
          const secret = this.secrets.get(source.secretRef.name);
          if (secret) {
            Object.assign(env, secret.data);
          }
        }
      }
    }

    // Parse ports
    const ports = container.ports?.map(p => p.containerPort) ?? [];

    // Parse health check
    let healthCheck: DWSWorkerConfig['healthCheck'];
    if (container.readinessProbe?.httpGet) {
      healthCheck = {
        path: container.readinessProbe.httpGet.path,
        port: container.readinessProbe.httpGet.port,
        intervalMs: (container.readinessProbe.periodSeconds ?? 10) * 1000,
      };
    }

    return {
      id: `worker-${deploymentName}-${container.name}-${Date.now()}`,
      name: `${deploymentName}-${container.name}`,
      image: container.image,
      replicas,
      resources: {
        cpuMillis: this.parseCPU(cpuRequest),
        memoryMb: this.parseMemory(memoryRequest),
        gpuCount: gpuCount ? parseInt(gpuCount, 10) : undefined,
      },
      env,
      ports,
      healthCheck,
    };
  }

  private parseService(manifest: KubeManifest): DWSServiceConfig {
    const spec = manifest.spec as {
      selector?: Record<string, string>;
      ports?: Array<{ port: number; targetPort?: number; name?: string }>;
      type?: string;
    };

    return {
      id: `svc-${manifest.metadata.name}-${Date.now()}`,
      name: manifest.metadata.name,
      selector: spec.selector ?? {},
      ports: spec.ports?.map(p => ({
        port: p.port,
        targetPort: p.targetPort ?? p.port,
        name: p.name,
      })) ?? [],
      type: (spec.type as DWSServiceConfig['type']) ?? 'ClusterIP',
    };
  }

  private parsePVC(manifest: KubeManifest): DWSStorage {
    const spec = manifest.spec as {
      resources?: { requests?: { storage?: string } };
      storageClassName?: string;
    };

    const sizeStr = spec.resources?.requests?.storage ?? '1Gi';
    const sizeGb = this.parseStorage(sizeStr);

    return {
      id: `pvc-${manifest.metadata.name}-${Date.now()}`,
      name: manifest.metadata.name,
      sizeGb,
      storageClass: spec.storageClassName ?? 'standard',
    };
  }

  private parseCPU(cpu: string): number {
    if (cpu.endsWith('m')) {
      return parseInt(cpu.slice(0, -1), 10);
    }
    return parseFloat(cpu) * 1000;
  }

  private parseMemory(memory: string): number {
    const value = parseInt(memory, 10);
    if (memory.endsWith('Gi')) return value * 1024;
    if (memory.endsWith('Mi')) return value;
    if (memory.endsWith('Ki')) return Math.ceil(value / 1024);
    if (memory.endsWith('G')) return value * 1000;
    if (memory.endsWith('M')) return value;
    return value / (1024 * 1024); // bytes to MB
  }

  private parseStorage(storage: string): number {
    const value = parseInt(storage, 10);
    if (storage.endsWith('Ti')) return value * 1024;
    if (storage.endsWith('Gi')) return value;
    if (storage.endsWith('Mi')) return Math.ceil(value / 1024);
    return value;
  }
}

// ============================================================================
// Helm Provider Router
// ============================================================================

const manifestsSchema = z.object({
  manifests: z.array(z.object({
    apiVersion: z.string(),
    kind: z.string(),
    metadata: z.object({
      name: z.string(),
      namespace: z.string().optional(),
      labels: z.record(z.string()).optional(),
      annotations: z.record(z.string()).optional(),
    }),
    spec: z.record(z.unknown()),
  })),
  release: z.string().optional(),
  namespace: z.string().optional(),
  values: z.record(z.unknown()).optional(),
});

const deployments = new Map<string, DWSDeployment>();

export function createHelmProviderRouter(): Hono {
  const router = new Hono();
  const parser = new ManifestParser();

  // Health check
  router.get('/helm/health', (c) => {
    return c.json({ status: 'healthy', provider: 'dws-helm' });
  });

  // Apply Helm release / K8s manifests
  router.post('/helm/apply', async (c) => {
    const body = await validateBody(manifestsSchema, c);
    const owner = c.req.header('x-jeju-address') as Address;

    const deployment = parser.parseManifests(body.manifests as KubeManifest[]);
    deployment.name = body.release ?? deployment.name;
    deployment.namespace = body.namespace ?? deployment.namespace;
    deployment.status = 'deploying';

    deployments.set(deployment.id, deployment);

    // Start async deployment
    deployToNetwork(deployment).catch(err => {
      console.error(`[Helm] Deployment ${deployment.id} failed:`, err);
      deployment.status = 'failed';
    });

    return c.json({
      id: deployment.id,
      name: deployment.name,
      namespace: deployment.namespace,
      workers: deployment.workers.length,
      services: deployment.services.length,
      status: deployment.status,
    });
  });

  // Get deployment status
  router.get('/helm/deployments/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    
    const deployment = deployments.get(id);
    if (!deployment) {
      return c.json({ error: 'Deployment not found' }, 404);
    }

    return c.json({
      id: deployment.id,
      name: deployment.name,
      namespace: deployment.namespace,
      workers: deployment.workers.map(w => ({
        id: w.id,
        name: w.name,
        replicas: w.replicas,
        image: w.image,
      })),
      services: deployment.services.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        ports: s.ports,
      })),
      status: deployment.status,
      createdAt: deployment.createdAt,
    });
  });

  // List deployments
  router.get('/helm/deployments', async (c) => {
    const list = Array.from(deployments.values()).map(d => ({
      id: d.id,
      name: d.name,
      namespace: d.namespace,
      status: d.status,
      createdAt: d.createdAt,
    }));

    return c.json({ deployments: list });
  });

  // Delete deployment
  router.delete('/helm/deployments/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    
    const deployment = deployments.get(id);
    if (!deployment) {
      return c.json({ error: 'Deployment not found' }, 404);
    }

    // Clean up resources
    await cleanupDeployment(deployment);
    deployments.delete(id);

    return c.json({ success: true, id });
  });

  // Scale deployment
  router.post('/helm/deployments/:id/scale', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    const body = await validateBody(z.object({
      worker: z.string(),
      replicas: z.number().min(0).max(100),
    }), c);
    
    const deployment = deployments.get(id);
    if (!deployment) {
      return c.json({ error: 'Deployment not found' }, 404);
    }

    const worker = deployment.workers.find(w => w.name === body.worker);
    if (!worker) {
      return c.json({ error: 'Worker not found' }, 404);
    }

    worker.replicas = body.replicas;
    // Scale would be implemented here

    return c.json({ success: true, worker: worker.name, replicas: body.replicas });
  });

  return router;
}

// ============================================================================
// Deployment Logic - Real Implementation
// ============================================================================

import { getCluster, applyManifest, installHelmChart } from './k3s-provider';
import { getServiceMesh } from './service-mesh';
import { getIngressController } from './ingress';

// Runtime context for deployment
interface DeploymentContext {
  localDockerEnabled: boolean;
  k3sCluster?: string;
  nodeEndpoints: string[];
}

let deploymentContext: DeploymentContext = {
  localDockerEnabled: true,
  nodeEndpoints: [],
};

export function setDeploymentContext(ctx: Partial<DeploymentContext>): void {
  deploymentContext = { ...deploymentContext, ...ctx };
}

async function deployToNetwork(deployment: DWSDeployment): Promise<void> {
  console.log(`[Helm] Deploying ${deployment.name} to DWS network`);

  // Strategy 1: Deploy to local k3s/k3d cluster if available
  if (deploymentContext.k3sCluster) {
    await deployToK3sCluster(deployment, deploymentContext.k3sCluster);
    return;
  }

  // Strategy 2: Deploy to local Docker
  if (deploymentContext.localDockerEnabled) {
    await deployToLocalDocker(deployment);
    return;
  }

  // Strategy 3: Deploy to decentralized nodes
  if (deploymentContext.nodeEndpoints.length > 0) {
    await deployToDecentralizedNodes(deployment);
    return;
  }

  throw new Error('No deployment target available. Enable Docker, create a k3s cluster, or register nodes.');
}

async function deployToK3sCluster(deployment: DWSDeployment, clusterName: string): Promise<void> {
  const cluster = getCluster(clusterName);
  if (!cluster) {
    throw new Error(`Cluster ${clusterName} not found`);
  }

  console.log(`[Helm] Deploying to k3s cluster: ${clusterName}`);

  // Convert DWS deployment to K8s manifests
  const namespace = deployment.namespace || 'default';

  // Create namespace
  await applyManifest(clusterName, {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: { name: namespace },
  });

  // Deploy ConfigMaps
  for (const cm of deployment.configMaps) {
    await applyManifest(clusterName, {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: cm.name, namespace },
      data: cm.data,
    });
  }

  // Deploy Secrets
  for (const secret of deployment.secrets) {
    await applyManifest(clusterName, {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: secret.name, namespace },
      type: 'Opaque',
      stringData: secret.data,
    });
  }

  // Deploy PVCs
  for (const storage of deployment.storage) {
    await applyManifest(clusterName, {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { name: storage.name, namespace },
      spec: {
        accessModes: ['ReadWriteOnce'],
        storageClassName: storage.storageClass,
        resources: { requests: { storage: `${storage.sizeGb}Gi` } },
      },
    });
  }

  // Deploy workloads as Deployments
  for (const worker of deployment.workers) {
    const result = await applyManifest(clusterName, {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: worker.name, namespace },
      spec: {
        replicas: worker.replicas,
        selector: { matchLabels: { app: worker.name } },
        template: {
          metadata: { labels: { app: worker.name } },
          spec: {
            containers: [{
              name: worker.name,
              image: worker.image,
              ports: worker.ports.map(p => ({ containerPort: p })),
              env: Object.entries(worker.env).map(([name, value]) => ({ name, value })),
              resources: {
                requests: {
                  cpu: `${worker.resources.cpuMillis}m`,
                  memory: `${worker.resources.memoryMb}Mi`,
                },
                limits: {
                  cpu: `${worker.resources.cpuMillis * 2}m`,
                  memory: `${worker.resources.memoryMb * 2}Mi`,
                },
              },
              ...(worker.healthCheck ? {
                readinessProbe: {
                  httpGet: { path: worker.healthCheck.path, port: worker.healthCheck.port },
                  periodSeconds: Math.floor(worker.healthCheck.intervalMs / 1000),
                },
              } : {}),
            }],
          },
        },
      },
    });

    if (!result.success) {
      console.error(`[Helm] Failed to deploy ${worker.name}: ${result.output}`);
    }
  }

  // Deploy Services
  for (const service of deployment.services) {
    await applyManifest(clusterName, {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: service.name, namespace },
      spec: {
        type: service.type,
        selector: service.selector,
        ports: service.ports.map(p => ({
          name: p.name || `port-${p.port}`,
          port: p.port,
          targetPort: p.targetPort,
        })),
      },
    });
  }

  deployment.status = 'running';
  console.log(`[Helm] Deployment ${deployment.name} complete on cluster ${clusterName}`);
}

async function deployToLocalDocker(deployment: DWSDeployment): Promise<void> {
  console.log(`[Helm] Deploying to local Docker`);

  const DOCKER_HOST = process.env.DOCKER_HOST || 'unix:///var/run/docker.sock';
  const DOCKER_API_URL = DOCKER_HOST.startsWith('unix://') ? 'http://localhost' : DOCKER_HOST;

  async function dockerRequest(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${DOCKER_API_URL}${path}`;
    if (DOCKER_HOST.startsWith('unix://')) {
      return fetch(url, { ...options, unix: DOCKER_HOST.replace('unix://', '') } as RequestInit);
    }
    return fetch(url, options);
  }

  // Create network for this deployment
  const networkName = `dws-${deployment.id}`;
  await dockerRequest('/v1.44/networks/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Name: networkName, Driver: 'bridge' }),
  }).catch(() => {}); // Ignore if exists

  // Deploy containers
  for (const worker of deployment.workers) {
    for (let i = 0; i < worker.replicas; i++) {
      const containerName = `${worker.name}-${i}`;
      
      // Create container
      const createResponse = await dockerRequest('/v1.44/containers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Image: worker.image,
          Hostname: containerName,
          Env: Object.entries(worker.env).map(([k, v]) => `${k}=${v}`),
          HostConfig: {
            Memory: worker.resources.memoryMb * 1024 * 1024,
            NanoCpus: worker.resources.cpuMillis * 1000000,
            NetworkMode: networkName,
            RestartPolicy: { Name: 'unless-stopped' },
          },
          Labels: {
            'dws.deployment.id': deployment.id,
            'dws.worker.name': worker.name,
            'dws.worker.replica': String(i),
          },
        }),
      });

      if (!createResponse.ok) {
        const err = await createResponse.text();
        console.error(`[Helm] Failed to create container ${containerName}: ${err}`);
        continue;
      }

      const { Id: containerId } = await createResponse.json() as { Id: string };

      // Start container
      const startResponse = await dockerRequest(`/v1.44/containers/${containerId}/start`, {
        method: 'POST',
      });

      if (startResponse.ok) {
        console.log(`[Helm] Started container ${containerName}`);
      }
    }
  }

  // Register with service mesh if available
  const serviceMesh = getServiceMesh();
  if (serviceMesh) {
    for (const service of deployment.services) {
      // Get container IPs for this service
      const listResponse = await dockerRequest(`/v1.44/containers/json?filters=${encodeURIComponent(JSON.stringify({ label: [`dws.deployment.id=${deployment.id}`] }))}`);
      const containers = await listResponse.json() as Array<{ NetworkSettings: { Networks: Record<string, { IPAddress: string }> } }>;
      
      const backends = containers
        .map(c => c.NetworkSettings?.Networks?.[networkName]?.IPAddress)
        .filter(Boolean)
        .map(ip => ({ endpoint: `http://${ip}:${service.ports[0]?.targetPort || 8080}`, weight: 1 }));

      if (backends.length > 0) {
        serviceMesh.registerBackends({
          name: service.name,
          namespace: deployment.namespace,
          backends,
        });
      }
    }
  }

  deployment.status = 'running';
  console.log(`[Helm] Deployment ${deployment.name} complete on local Docker`);
}

async function deployToDecentralizedNodes(deployment: DWSDeployment): Promise<void> {
  console.log(`[Helm] Deploying to decentralized nodes`);

  const endpoints = deploymentContext.nodeEndpoints;
  let deployedCount = 0;

  for (const worker of deployment.workers) {
    // Distribute replicas across nodes
    for (let i = 0; i < worker.replicas; i++) {
      const nodeEndpoint = endpoints[i % endpoints.length];
      
      const response = await fetch(`${nodeEndpoint}/containers/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: worker.image,
          name: `${worker.name}-${i}`,
          env: worker.env,
          resources: {
            cpuCores: Math.ceil(worker.resources.cpuMillis / 1000),
            memoryMb: worker.resources.memoryMb,
          },
          ports: worker.ports,
          labels: {
            'dws.deployment.id': deployment.id,
            'dws.worker.name': worker.name,
          },
        }),
        signal: AbortSignal.timeout(30000),
      }).catch(err => {
        console.error(`[Helm] Failed to deploy to ${nodeEndpoint}: ${err}`);
        return null;
      });

      if (response?.ok) {
        deployedCount++;
        console.log(`[Helm] Deployed ${worker.name}-${i} to ${nodeEndpoint}`);
      }
    }
  }

  if (deployedCount === 0) {
    deployment.status = 'failed';
    throw new Error('Failed to deploy to any node');
  }

  // Configure ingress
  const ingressController = getIngressController();
  if (ingressController) {
    for (const service of deployment.services) {
      if (service.type === 'LoadBalancer') {
        ingressController.registerService({
          name: service.name,
          namespace: deployment.namespace,
          host: `${service.name}.dws.local`,
          backends: endpoints.map(ep => ({ endpoint: ep, weight: 1 })),
        });
      }
    }
  }

  deployment.status = 'running';
  console.log(`[Helm] Deployment ${deployment.name} complete: ${deployedCount} containers across ${endpoints.length} nodes`);
}

async function cleanupDeployment(deployment: DWSDeployment): Promise<void> {
  console.log(`[Helm] Cleaning up deployment ${deployment.name}`);

  // Strategy 1: Cleanup from k3s cluster
  if (deploymentContext.k3sCluster) {
    const cluster = getCluster(deploymentContext.k3sCluster);
    if (cluster) {
      const kubectl = process.env.KUBECTL_PATH || 'kubectl';
      const proc = Bun.spawn([
        kubectl, 'delete', 'all', '-l', `dws.deployment.id=${deployment.id}`,
        '--namespace', deployment.namespace,
        '--kubeconfig', cluster.kubeconfig,
      ]);
      await proc.exited;
    }
    return;
  }

  // Strategy 2: Cleanup from local Docker
  if (deploymentContext.localDockerEnabled) {
    const DOCKER_HOST = process.env.DOCKER_HOST || 'unix:///var/run/docker.sock';
    const DOCKER_API_URL = DOCKER_HOST.startsWith('unix://') ? 'http://localhost' : DOCKER_HOST;

    const dockerRequest = async (path: string, options: RequestInit = {}): Promise<Response> => {
      const url = `${DOCKER_API_URL}${path}`;
      if (DOCKER_HOST.startsWith('unix://')) {
        return fetch(url, { ...options, unix: DOCKER_HOST.replace('unix://', '') } as RequestInit);
      }
      return fetch(url, options);
    };

    // List and remove containers
    const listResponse = await dockerRequest(`/v1.44/containers/json?all=true&filters=${encodeURIComponent(JSON.stringify({ label: [`dws.deployment.id=${deployment.id}`] }))}`);
    const containers = await listResponse.json() as Array<{ Id: string; Names: string[] }>;

    for (const container of containers) {
      await dockerRequest(`/v1.44/containers/${container.Id}?force=true`, { method: 'DELETE' });
      console.log(`[Helm] Removed container ${container.Names[0]}`);
    }

    // Remove network
    await dockerRequest(`/v1.44/networks/dws-${deployment.id}`, { method: 'DELETE' }).catch(() => {});
    return;
  }

  // Strategy 3: Cleanup from decentralized nodes
  for (const nodeEndpoint of deploymentContext.nodeEndpoints) {
    await fetch(`${nodeEndpoint}/containers/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deploymentId: deployment.id }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
  }

  console.log(`[Helm] Cleanup complete for deployment ${deployment.name}`);
}

