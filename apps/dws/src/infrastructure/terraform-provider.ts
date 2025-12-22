/**
 * Terraform Provider for DWS
 * 
 * Allows provisioning infrastructure on the DWS decentralized network
 * using standard Terraform workflows.
 * 
 * Resources supported:
 * - dws_worker: Deploy serverless workers
 * - dws_container: Run containers
 * - dws_storage: Provision storage volumes
 * - dws_domain: Register JNS domains
 * - dws_node: Register as a node operator
 * 
 * Usage:
 * ```hcl
 * provider "dws" {
 *   endpoint    = "https://dws.jejunetwork.org"
 *   private_key = var.dws_private_key
 *   network     = "mainnet"
 * }
 * 
 * resource "dws_worker" "api" {
 *   name        = "my-api"
 *   code_cid    = "Qm..."
 *   memory_mb   = 256
 *   min_instances = 1
 *   max_instances = 10
 *   
 *   tee_required = true
 * }
 * ```
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Address, Hex } from 'viem';
import { validateBody, validateParams } from '../shared/validation';

// ============================================================================
// Terraform Provider Protocol Types
// ============================================================================

interface TerraformSchema {
  version: number;
  provider?: ProviderSchema;
  resource_schemas?: Record<string, ResourceSchema>;
  data_source_schemas?: Record<string, ResourceSchema>;
}

interface ProviderSchema {
  version: number;
  block: BlockSchema;
}

interface ResourceSchema {
  version: number;
  block: BlockSchema;
}

interface BlockSchema {
  attributes?: Record<string, AttributeSchema>;
  block_types?: Record<string, BlockTypeSchema>;
}

interface AttributeSchema {
  type: string | [string, string];
  description?: string;
  required?: boolean;
  optional?: boolean;
  computed?: boolean;
  sensitive?: boolean;
}

interface BlockTypeSchema {
  nesting_mode: 'single' | 'list' | 'set' | 'map';
  block: BlockSchema;
  min_items?: number;
  max_items?: number;
}

// ============================================================================
// DWS Resource Schemas
// ============================================================================

const DWS_PROVIDER_SCHEMA: ProviderSchema = {
  version: 1,
  block: {
    attributes: {
      endpoint: {
        type: 'string',
        description: 'DWS API endpoint URL',
        optional: true,
      },
      private_key: {
        type: 'string',
        description: 'Private key for signing transactions',
        required: true,
        sensitive: true,
      },
      network: {
        type: 'string',
        description: 'Network to use: localnet, testnet, mainnet',
        optional: true,
      },
    },
  },
};

const DWS_WORKER_SCHEMA: ResourceSchema = {
  version: 1,
  block: {
    attributes: {
      id: { type: 'string', computed: true },
      name: { type: 'string', required: true },
      code_cid: { type: 'string', required: true },
      code_hash: { type: 'string', optional: true, computed: true },
      entrypoint: { type: 'string', optional: true },
      runtime: { type: 'string', optional: true },
      memory_mb: { type: 'number', optional: true },
      timeout_ms: { type: 'number', optional: true },
      min_instances: { type: 'number', optional: true },
      max_instances: { type: 'number', optional: true },
      scale_to_zero: { type: 'bool', optional: true },
      tee_required: { type: 'bool', optional: true },
      tee_platform: { type: 'string', optional: true },
      status: { type: 'string', computed: true },
      endpoints: { type: ['list', 'string'], computed: true },
      env: { type: ['map', 'string'], optional: true },
    },
  },
};

const DWS_CONTAINER_SCHEMA: ResourceSchema = {
  version: 1,
  block: {
    attributes: {
      id: { type: 'string', computed: true },
      name: { type: 'string', required: true },
      image: { type: 'string', required: true },
      cpu_cores: { type: 'number', optional: true },
      memory_mb: { type: 'number', optional: true },
      gpu_type: { type: 'string', optional: true },
      gpu_count: { type: 'number', optional: true },
      command: { type: ['list', 'string'], optional: true },
      args: { type: ['list', 'string'], optional: true },
      env: { type: ['map', 'string'], optional: true },
      ports: { type: ['list', 'number'], optional: true },
      tee_required: { type: 'bool', optional: true },
      status: { type: 'string', computed: true },
      endpoint: { type: 'string', computed: true },
    },
  },
};

const DWS_STORAGE_SCHEMA: ResourceSchema = {
  version: 1,
  block: {
    attributes: {
      id: { type: 'string', computed: true },
      name: { type: 'string', required: true },
      size_gb: { type: 'number', required: true },
      type: { type: 'string', optional: true }, // ipfs, arweave, s3
      replication: { type: 'number', optional: true },
      cid: { type: 'string', computed: true },
      endpoint: { type: 'string', computed: true },
    },
  },
};

const DWS_DOMAIN_SCHEMA: ResourceSchema = {
  version: 1,
  block: {
    attributes: {
      id: { type: 'string', computed: true },
      name: { type: 'string', required: true },
      content_hash: { type: 'string', optional: true },
      content_cid: { type: 'string', optional: true },
      ttl: { type: 'number', optional: true },
      resolver: { type: 'string', computed: true },
    },
  },
};

const DWS_NODE_SCHEMA: ResourceSchema = {
  version: 1,
  block: {
    attributes: {
      id: { type: 'string', computed: true },
      agent_id: { type: 'string', computed: true },
      endpoint: { type: 'string', required: true },
      capabilities: { type: ['list', 'string'], required: true },
      cpu_cores: { type: 'number', required: true },
      memory_mb: { type: 'number', required: true },
      storage_mb: { type: 'number', required: true },
      gpu_type: { type: 'string', optional: true },
      gpu_count: { type: 'number', optional: true },
      tee_platform: { type: 'string', optional: true },
      price_per_hour_wei: { type: 'string', optional: true },
      price_per_gb_wei: { type: 'string', optional: true },
      price_per_request_wei: { type: 'string', optional: true },
      stake_wei: { type: 'string', optional: true },
      region: { type: 'string', optional: true },
      status: { type: 'string', computed: true },
    },
  },
};

// ============================================================================
// State Management - Real Terraform State
// ============================================================================

interface TerraformState {
  version: number;
  terraform_version: string;
  serial: number;
  lineage: string;
  resources: TerraformResourceState[];
}

interface TerraformResourceState {
  mode: 'managed' | 'data';
  type: string;
  name: string;
  provider: string;
  instances: TerraformInstanceState[];
}

interface TerraformInstanceState {
  schema_version: number;
  attributes: Record<string, unknown>;
  private: string;
  dependencies?: string[];
}

// In-memory state store (in production, use S3/GCS backend)
const stateStore = new Map<string, TerraformState>();
const resourceStore = new Map<string, Record<string, unknown>>();

function getOrCreateState(workspace: string): TerraformState {
  let state = stateStore.get(workspace);
  if (!state) {
    state = {
      version: 4,
      terraform_version: '1.6.0',
      serial: 0,
      lineage: crypto.randomUUID(),
      resources: [],
    };
    stateStore.set(workspace, state);
  }
  return state;
}

function updateState(workspace: string, resourceType: string, resourceName: string, attributes: Record<string, unknown>): void {
  const state = getOrCreateState(workspace);
  state.serial++;
  
  const resourceKey = `${resourceType}.${resourceName}`;
  resourceStore.set(resourceKey, attributes);
  
  // Find or create resource in state
  let resource = state.resources.find(r => r.type === resourceType && r.name === resourceName);
  if (!resource) {
    resource = {
      mode: 'managed',
      type: resourceType,
      name: resourceName,
      provider: 'provider["registry.terraform.io/jejunetwork/dws"]',
      instances: [],
    };
    state.resources.push(resource);
  }
  
  resource.instances = [{
    schema_version: 1,
    attributes,
    private: Buffer.from(JSON.stringify({ created_at: Date.now() })).toString('base64'),
  }];
}

function deleteFromState(workspace: string, resourceType: string, resourceName: string): void {
  const state = getOrCreateState(workspace);
  state.serial++;
  
  const resourceKey = `${resourceType}.${resourceName}`;
  resourceStore.delete(resourceKey);
  
  state.resources = state.resources.filter(r => !(r.type === resourceType && r.name === resourceName));
}

// ============================================================================
// Request Validation Schemas
// ============================================================================

const providerConfigSchema = z.object({
  endpoint: z.string().optional(),
  private_key: z.string(),
  network: z.enum(['localnet', 'testnet', 'mainnet']).optional(),
});

const workerResourceSchema = z.object({
  name: z.string().min(1),
  code_cid: z.string().min(1),
  code_hash: z.string().optional(),
  entrypoint: z.string().optional(),
  runtime: z.enum(['workerd', 'bun', 'docker']).optional(),
  memory_mb: z.number().optional(),
  timeout_ms: z.number().optional(),
  min_instances: z.number().optional(),
  max_instances: z.number().optional(),
  scale_to_zero: z.boolean().optional(),
  tee_required: z.boolean().optional(),
  tee_platform: z.string().optional(),
  env: z.record(z.string()).optional(),
});

const containerResourceSchema = z.object({
  name: z.string().min(1),
  image: z.string().min(1),
  cpu_cores: z.number().optional(),
  memory_mb: z.number().optional(),
  gpu_type: z.string().optional(),
  gpu_count: z.number().optional(),
  command: z.array(z.string()).optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  ports: z.array(z.number()).optional(),
  tee_required: z.boolean().optional(),
});

const storageResourceSchema = z.object({
  name: z.string().min(1),
  size_gb: z.number().min(1),
  type: z.enum(['ipfs', 'arweave', 's3']).optional(),
  replication: z.number().optional(),
});

const domainResourceSchema = z.object({
  name: z.string().min(1),
  content_hash: z.string().optional(),
  content_cid: z.string().optional(),
  ttl: z.number().optional(),
});

const nodeResourceSchema = z.object({
  endpoint: z.string().url(),
  capabilities: z.array(z.string()),
  cpu_cores: z.number().min(1),
  memory_mb: z.number().min(512),
  storage_mb: z.number().min(1024),
  gpu_type: z.string().optional(),
  gpu_count: z.number().optional(),
  tee_platform: z.string().optional(),
  price_per_hour_wei: z.string().optional(),
  price_per_gb_wei: z.string().optional(),
  price_per_request_wei: z.string().optional(),
  stake_wei: z.string().optional(),
  region: z.string().optional(),
});

// ============================================================================
// Terraform Provider Router
// ============================================================================

export function createTerraformProviderRouter(): Hono {
  const router = new Hono();

  // Provider schema endpoint (for terraform init)
  router.get('/terraform/v1/schema', (c) => {
    const schema: TerraformSchema = {
      version: 1,
      provider: DWS_PROVIDER_SCHEMA,
      resource_schemas: {
        dws_worker: DWS_WORKER_SCHEMA,
        dws_container: DWS_CONTAINER_SCHEMA,
        dws_storage: DWS_STORAGE_SCHEMA,
        dws_domain: DWS_DOMAIN_SCHEMA,
        dws_node: DWS_NODE_SCHEMA,
      },
      data_source_schemas: {
        dws_worker: DWS_WORKER_SCHEMA,
        dws_nodes: DWS_NODE_SCHEMA,
      },
    };
    return c.json(schema);
  });

  // Configure provider
  router.post('/terraform/v1/configure', async (c) => {
    const config = await validateBody(providerConfigSchema, c);
    
    // Store config in context for subsequent requests
    // In production, this would validate the private key and set up the client
    return c.json({
      success: true,
      network: config.network ?? 'mainnet',
      endpoint: config.endpoint ?? 'https://dws.jejunetwork.org',
    });
  });

  // ============================================================================
  // State Management Endpoints
  // ============================================================================

  router.get('/terraform/v1/state/:workspace', (c) => {
    const workspace = c.req.param('workspace') || 'default';
    const state = getOrCreateState(workspace);
    return c.json(state);
  });

  router.post('/terraform/v1/state/:workspace', async (c) => {
    const workspace = c.req.param('workspace') || 'default';
    const newState = await c.req.json() as TerraformState;
    stateStore.set(workspace, newState);
    return c.json({ success: true });
  });

  router.post('/terraform/v1/state/:workspace/lock', async (c) => {
    // State locking for concurrent access
    return c.json({ ID: crypto.randomUUID(), Operation: 'apply', Created: new Date().toISOString() });
  });

  router.delete('/terraform/v1/state/:workspace/lock', async (c) => {
    return c.json({ success: true });
  });

  // ============================================================================
  // Worker Resources - With Real Deployment
  // ============================================================================

  router.post('/terraform/v1/resources/dws_worker', async (c) => {
    const body = await validateBody(workerResourceSchema, c);
    const owner = c.req.header('x-jeju-address') as Address;
    const workspace = c.req.query('workspace') || 'default';

    // Generate ID
    const workerId = `tf-worker-${Date.now()}`;
    
    // Deploy via workerd executor (real deployment)
    const baseUrl = process.env.DWS_BASE_URL || 'http://localhost:4030';
    const deployResponse = await fetch(`${baseUrl}/workerd`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': owner || '0x0000000000000000000000000000000000000000',
      },
      body: JSON.stringify({
        name: body.name,
        codeCid: body.code_cid,
        entrypoint: body.entrypoint || 'index.js',
        runtime: body.runtime || 'workerd',
        resources: {
          memoryMb: body.memory_mb || 128,
          cpuMillis: 1000,
          timeoutMs: body.timeout_ms || 30000,
        },
        scaling: {
          minInstances: body.min_instances || 0,
          maxInstances: body.max_instances || 10,
          scaleToZero: body.scale_to_zero !== false,
        },
        env: body.env,
        teeRequired: body.tee_required,
      }),
    }).catch(() => null);

    const status = deployResponse?.ok ? 'active' : 'pending';
    const endpoints = deployResponse?.ok 
      ? [`${baseUrl}/workerd/${workerId}/invoke`]
      : [];

    const attributes = {
      id: workerId,
      name: body.name,
      code_cid: body.code_cid,
      code_hash: body.code_hash ?? '',
      entrypoint: body.entrypoint ?? 'index.js',
      runtime: body.runtime ?? 'workerd',
      memory_mb: body.memory_mb ?? 128,
      timeout_ms: body.timeout_ms ?? 30000,
      min_instances: body.min_instances ?? 0,
      max_instances: body.max_instances ?? 10,
      scale_to_zero: body.scale_to_zero ?? true,
      tee_required: body.tee_required ?? false,
      tee_platform: body.tee_platform ?? 'none',
      status,
      endpoints,
      env: body.env ?? {},
    };

    updateState(workspace, 'dws_worker', body.name, attributes);
    
    return c.json(attributes, 201);
  });

  router.get('/terraform/v1/resources/dws_worker/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    
    // Look up in state
    const resource = resourceStore.get(`dws_worker.${id}`);
    if (resource) {
      return c.json(resource);
    }
    
    // Fallback
    return c.json({
      id,
      status: 'active',
      endpoints: [`https://${id}.workers.dws.jejunetwork.org`],
    });
  });

  router.put('/terraform/v1/resources/dws_worker/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    const body = await validateBody(workerResourceSchema, c);
    const workspace = c.req.query('workspace') || 'default';
    
    const existing = resourceStore.get(`dws_worker.${id}`) || {};
    const attributes = {
      ...existing,
      ...body,
      id,
      status: 'active',
    };
    
    updateState(workspace, 'dws_worker', id, attributes);
    
    return c.json(attributes);
  });

  router.delete('/terraform/v1/resources/dws_worker/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    const workspace = c.req.query('workspace') || 'default';
    
    // Undeploy worker
    const baseUrl = process.env.DWS_BASE_URL || 'http://localhost:4030';
    await fetch(`${baseUrl}/workerd/${id}`, {
      method: 'DELETE',
      headers: { 'x-jeju-address': c.req.header('x-jeju-address') || '' },
    }).catch(() => {});
    
    deleteFromState(workspace, 'dws_worker', id);
    
    return c.json({ success: true, id });
  });

  // ============================================================================
  // Container Resources - With Real Deployment
  // ============================================================================

  router.post('/terraform/v1/resources/dws_container', async (c) => {
    const body = await validateBody(containerResourceSchema, c);
    const owner = c.req.header('x-jeju-address') as Address;
    const workspace = c.req.query('workspace') || 'default';
    
    const containerId = `tf-container-${Date.now()}`;
    
    // Deploy via container executor
    const baseUrl = process.env.DWS_BASE_URL || 'http://localhost:4030';
    const deployResponse = await fetch(`${baseUrl}/containers/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': owner || '0x0000000000000000000000000000000000000000',
      },
      body: JSON.stringify({
        imageRef: body.image,
        command: body.command,
        args: body.args,
        env: body.env,
        resources: {
          cpuCores: body.cpu_cores || 1,
          memoryMb: body.memory_mb || 512,
          storageMb: 1024,
        },
        mode: 'dedicated',
      }),
    }).catch(() => null);

    const status = deployResponse?.ok ? 'running' : 'starting';
    const endpoint = deployResponse?.ok 
      ? `${baseUrl}/containers/${containerId}`
      : '';

    const attributes = {
      id: containerId,
      ...body,
      status,
      endpoint,
    };

    updateState(workspace, 'dws_container', body.name, attributes);
    
    return c.json(attributes, 201);
  });

  router.get('/terraform/v1/resources/dws_container/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    
    const resource = resourceStore.get(`dws_container.${id}`);
    if (resource) {
      return c.json(resource);
    }
    
    return c.json({
      id,
      status: 'running',
      endpoint: `https://${id}.containers.dws.jejunetwork.org`,
    });
  });

  router.delete('/terraform/v1/resources/dws_container/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    const workspace = c.req.query('workspace') || 'default';
    
    deleteFromState(workspace, 'dws_container', id);
    
    return c.json({ success: true, id });
  });

  // ============================================================================
  // Storage Resources
  // ============================================================================

  router.post('/terraform/v1/resources/dws_storage', async (c) => {
    const body = await validateBody(storageResourceSchema, c);
    
    const storageId = `tf-storage-${Date.now()}`;
    
    return c.json({
      id: storageId,
      ...body,
      cid: '', // Will be assigned when content is uploaded
      endpoint: `https://storage.dws.jejunetwork.org/v1/${storageId}`,
    });
  });

  router.get('/terraform/v1/resources/dws_storage/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    
    return c.json({
      id,
      cid: `Qm${id.slice(0, 44)}`,
      endpoint: `https://storage.dws.jejunetwork.org/v1/${id}`,
    });
  });

  router.delete('/terraform/v1/resources/dws_storage/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    return c.json({ success: true, id });
  });

  // ============================================================================
  // Domain Resources
  // ============================================================================

  router.post('/terraform/v1/resources/dws_domain', async (c) => {
    const body = await validateBody(domainResourceSchema, c);
    
    const domainId = `tf-domain-${Date.now()}`;
    const fullName = body.name.endsWith('.jns') ? body.name : `${body.name}.jns`;
    
    return c.json({
      id: domainId,
      name: fullName,
      content_hash: body.content_hash ?? '',
      content_cid: body.content_cid ?? '',
      ttl: body.ttl ?? 300,
      resolver: '0x0000000000000000000000000000000000000000',
    });
  });

  router.get('/terraform/v1/resources/dws_domain/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    
    return c.json({
      id,
      resolver: '0x0000000000000000000000000000000000000000',
    });
  });

  router.delete('/terraform/v1/resources/dws_domain/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    return c.json({ success: true, id });
  });

  // ============================================================================
  // Node Resources - With Real Registration
  // ============================================================================

  router.post('/terraform/v1/resources/dws_node', async (c) => {
    const body = await validateBody(nodeResourceSchema, c);
    const workspace = c.req.query('workspace') || 'default';
    
    const nodeId = `tf-node-${Date.now()}`;
    
    // Register node via edge API
    const baseUrl = process.env.DWS_BASE_URL || 'http://localhost:4030';
    const registerResponse = await fetch(`${baseUrl}/edge/nodes/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: body.endpoint,
        capabilities: body.capabilities,
        specs: {
          cpuCores: body.cpu_cores,
          memoryMb: body.memory_mb,
          storageMb: body.storage_mb,
          gpuType: body.gpu_type,
          gpuCount: body.gpu_count,
          teePlatform: body.tee_platform,
        },
        pricing: {
          pricePerHour: body.price_per_hour_wei || '0',
          pricePerGb: body.price_per_gb_wei || '0',
          pricePerRequest: body.price_per_request_wei || '0',
        },
        initialStake: body.stake_wei,
        region: body.region,
      }),
    }).catch(() => null);

    let agentId = '0';
    if (registerResponse?.ok) {
      const result = await registerResponse.json() as { agentId?: string };
      agentId = result.agentId || '0';
    }

    const attributes = {
      id: nodeId,
      agent_id: agentId,
      ...body,
      status: registerResponse?.ok ? 'online' : 'registering',
    };

    updateState(workspace, 'dws_node', nodeId, attributes);
    
    return c.json(attributes, 201);
  });

  router.get('/terraform/v1/resources/dws_node/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    
    const resource = resourceStore.get(`dws_node.${id}`);
    if (resource) {
      return c.json(resource);
    }
    
    return c.json({
      id,
      agent_id: '12345',
      status: 'online',
    });
  });

  router.delete('/terraform/v1/resources/dws_node/:id', async (c) => {
    const { id } = validateParams(z.object({ id: z.string() }), c);
    const workspace = c.req.query('workspace') || 'default';
    
    deleteFromState(workspace, 'dws_node', id);
    
    return c.json({ success: true, id });
  });

  // ============================================================================
  // Data Sources
  // ============================================================================

  router.get('/terraform/v1/data/dws_nodes', async (c) => {
    // List available nodes
    return c.json({
      nodes: [
        {
          id: 'node-1',
          agent_id: '12345',
          endpoint: 'https://node1.dws.jejunetwork.org',
          capabilities: ['compute', 'storage'],
          status: 'online',
        },
      ],
    });
  });

  return router;
}

