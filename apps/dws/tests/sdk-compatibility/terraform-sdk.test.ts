/**
 * Terraform SDK Compatibility Test
 *
 * Tests deploying a full-stack app to DWS using actual Terraform CLI.
 * Validates that DWS provides a proper Terraform provider interface.
 *
 * Requirements:
 * - terraform CLI installed
 * - DWS server running
 *
 * Run with: bun test tests/sdk-compatibility/terraform-sdk.test.ts
 */

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dwsRequest } from '../setup'

setDefaultTimeout(120000) // Terraform can be slow

const TEST_DIR = '/tmp/dws-terraform-sdk-test'
const DWS_URL = 'http://localhost:4030'

// Check if terraform is installed
function isTerraformInstalled(): boolean {
  try {
    Bun.spawnSync(['terraform', 'version'])
    return true
  } catch {
    return false
  }
}

const TERRAFORM_AVAILABLE = isTerraformInstalled()

// Generate Terraform configuration for DWS
function generateTerraformConfig(dwsEndpoint: string): string {
  return `
terraform {
  required_providers {
    http = {
      source  = "hashicorp/http"
      version = "~> 3.0"
    }
  }
}

# DWS Provider configuration via HTTP data source
# In production, this would be a custom terraform-provider-dws

variable "dws_endpoint" {
  default = "${dwsEndpoint}"
}

variable "dws_private_key" {
  default = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  sensitive = true
}

# Configure DWS provider
data "http" "dws_configure" {
  url = "\${var.dws_endpoint}/terraform/v1/configure"
  method = "POST"
  request_headers = {
    Content-Type = "application/json"
  }
  request_body = jsonencode({
    endpoint    = var.dws_endpoint
    private_key = var.dws_private_key
    network     = "localnet"
  })
}

# Deploy a worker
resource "null_resource" "dws_worker" {
  triggers = {
    name     = "terraform-test-worker"
    code_cid = "QmTestWorkerCode123"
    runtime  = "workerd"
  }

  provisioner "local-exec" {
    command = <<-EOT
      curl -s -X POST "\${var.dws_endpoint}/terraform/v1/resources/dws_worker" \
        -H "Content-Type: application/json" \
        -H "x-jeju-address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" \
        -d '{
          "name": "terraform-test-worker",
          "code_cid": "QmTestWorkerCode123",
          "runtime": "workerd",
          "memory_mb": 128,
          "max_instances": 5,
          "env": {"NODE_ENV": "production"}
        }' > worker-result.json
    EOT
  }
}

# Deploy a container
resource "null_resource" "dws_container" {
  depends_on = [null_resource.dws_worker]

  triggers = {
    name  = "terraform-test-db"
    image = "postgres:15-alpine"
  }

  provisioner "local-exec" {
    command = <<-EOT
      curl -s -X POST "\${var.dws_endpoint}/terraform/v1/resources/dws_container" \
        -H "Content-Type: application/json" \
        -H "x-jeju-address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" \
        -d '{
          "name": "terraform-test-db",
          "image": "postgres:15-alpine",
          "cpu_cores": 1,
          "memory_mb": 512,
          "env": {"POSTGRES_PASSWORD": "test123"}
        }' > container-result.json
    EOT
  }
}

# Provision storage
resource "null_resource" "dws_storage" {
  triggers = {
    name    = "terraform-test-storage"
    size_gb = 10
  }

  provisioner "local-exec" {
    command = <<-EOT
      curl -s -X POST "\${var.dws_endpoint}/terraform/v1/resources/dws_storage" \
        -H "Content-Type: application/json" \
        -H "x-jeju-address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" \
        -d '{
          "name": "terraform-test-storage",
          "size_gb": 10,
          "type": "s3"
        }' > storage-result.json
    EOT
  }
}

# Register a domain
resource "null_resource" "dws_domain" {
  depends_on = [null_resource.dws_worker]

  triggers = {
    name = "terraform-test.jns"
  }

  provisioner "local-exec" {
    command = <<-EOT
      curl -s -X POST "\${var.dws_endpoint}/terraform/v1/resources/dws_domain" \
        -H "Content-Type: application/json" \
        -H "x-jeju-address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" \
        -d '{
          "name": "terraform-test.jns",
          "content_cid": "QmTestWorkerCode123"
        }' > domain-result.json
    EOT
  }
}

output "configuration_result" {
  value = jsondecode(data.http.dws_configure.response_body)
}
`
}

describe('Terraform SDK Compatibility', () => {
  beforeAll(async () => {
    // Create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true })
    }
    mkdirSync(TEST_DIR, { recursive: true })

    console.log('[Terraform SDK Test] Test directory:', TEST_DIR)
    console.log(
      '[Terraform SDK Test] Terraform available:',
      TERRAFORM_AVAILABLE,
    )
  })

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true })
    }
  })

  describe('Terraform Provider API', () => {
    test('GET /terraform/v1/schema returns valid provider schema', async () => {
      const res = await dwsRequest('/terraform/v1/schema')
      expect(res.status).toBe(200)

      const schema = (await res.json()) as {
        version: number
        provider: { block: { attributes: Record<string, unknown> } }
        resource_schemas: Record<string, unknown>
        data_source_schemas: Record<string, unknown>
      }

      expect(schema.version).toBe(1)
      expect(schema.provider).toBeDefined()
      expect(schema.provider.block.attributes.endpoint).toBeDefined()
      expect(schema.provider.block.attributes.private_key).toBeDefined()
      expect(schema.provider.block.attributes.network).toBeDefined()

      // Verify resource schemas
      expect(schema.resource_schemas.dws_worker).toBeDefined()
      expect(schema.resource_schemas.dws_container).toBeDefined()
      expect(schema.resource_schemas.dws_storage).toBeDefined()
      expect(schema.resource_schemas.dws_domain).toBeDefined()
      expect(schema.resource_schemas.dws_node).toBeDefined()

      // Verify data source schemas
      expect(schema.data_source_schemas.dws_nodes).toBeDefined()
    })

    test('POST /terraform/v1/configure accepts provider config', async () => {
      const res = await dwsRequest('/terraform/v1/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'https://dws.jejunetwork.org',
          private_key:
            '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
          network: 'testnet',
        }),
      })

      expect(res.status).toBe(200)
      const data = (await res.json()) as { success: boolean; network: string }
      expect(data.success).toBe(true)
      expect(data.network).toBe('testnet')
    })
  })

  describe('Resource CRUD Operations', () => {
    test('creates and manages dws_worker resource', async () => {
      // Create
      const createRes = await dwsRequest('/terraform/v1/resources/dws_worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-jeju-address': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        },
        body: JSON.stringify({
          name: 'tf-crud-worker',
          code_cid: 'QmCrudTestCid',
          runtime: 'bun',
          memory_mb: 256,
          max_instances: 3,
        }),
      })

      expect(createRes.status).toBe(201)
      const created = (await createRes.json()) as {
        id: string
        name: string
        runtime: string
      }
      expect(created.id).toBeDefined()
      expect(created.name).toBe('tf-crud-worker')
      expect(created.runtime).toBe('bun')

      // Read
      const readRes = await dwsRequest(
        `/terraform/v1/resources/dws_worker/${created.id}`,
      )
      expect(readRes.status).toBe(200)

      // Update
      const updateRes = await dwsRequest(
        `/terraform/v1/resources/dws_worker/${created.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-jeju-address': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          },
          body: JSON.stringify({
            name: 'tf-crud-worker',
            code_cid: 'QmUpdatedCid',
            max_instances: 10,
          }),
        },
      )
      expect(updateRes.status).toBe(200)

      // Delete
      const deleteRes = await dwsRequest(
        `/terraform/v1/resources/dws_worker/${created.id}`,
        {
          method: 'DELETE',
        },
      )
      expect(deleteRes.status).toBe(200)
    })

    test('creates full-stack infrastructure', async () => {
      // Create worker
      const workerRes = await dwsRequest('/terraform/v1/resources/dws_worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-jeju-address': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        },
        body: JSON.stringify({
          name: 'fullstack-api',
          code_cid: 'QmFullstackAPI',
          runtime: 'workerd',
          memory_mb: 128,
        }),
      })
      expect(workerRes.status).toBe(201)
      const worker = (await workerRes.json()) as { id: string }

      // Create database container
      const dbRes = await dwsRequest('/terraform/v1/resources/dws_container', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-jeju-address': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        },
        body: JSON.stringify({
          name: 'fullstack-db',
          image: 'postgres:15-alpine',
          cpu_cores: 2,
          memory_mb: 1024,
          env: { POSTGRES_DB: 'app', POSTGRES_USER: 'app' },
        }),
      })
      expect(dbRes.status).toBe(201)
      const db = (await dbRes.json()) as { id: string }

      // Create storage
      const storageRes = await dwsRequest(
        '/terraform/v1/resources/dws_storage',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-jeju-address': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          },
          body: JSON.stringify({
            name: 'fullstack-storage',
            size_gb: 50,
            type: 's3',
            replication: 3,
          }),
        },
      )
      expect(storageRes.status).toBe(200)
      const storage = (await storageRes.json()) as { id: string }

      // Create domain
      const domainRes = await dwsRequest('/terraform/v1/resources/dws_domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-jeju-address': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        },
        body: JSON.stringify({
          name: 'fullstack-app.jns',
          content_cid: 'QmFullstackAPI',
        }),
      })
      expect(domainRes.status).toBe(200)

      // Cleanup
      await dwsRequest(`/terraform/v1/resources/dws_worker/${worker.id}`, {
        method: 'DELETE',
      })
      await dwsRequest(`/terraform/v1/resources/dws_container/${db.id}`, {
        method: 'DELETE',
      })
      await dwsRequest(`/terraform/v1/resources/dws_storage/${storage.id}`, {
        method: 'DELETE',
      })
    })
  })

  describe.skipIf(!TERRAFORM_AVAILABLE)('Terraform CLI Integration', () => {
    test('terraform init succeeds with DWS config', async () => {
      const config = generateTerraformConfig(DWS_URL)
      writeFileSync(join(TEST_DIR, 'main.tf'), config)

      const result = Bun.spawnSync(['terraform', 'init'], {
        cwd: TEST_DIR,
        env: { ...process.env, TF_IN_AUTOMATION: '1' },
      })

      expect(result.exitCode).toBe(0)
      expect(existsSync(join(TEST_DIR, '.terraform'))).toBe(true)
    })

    test('terraform plan shows resources to create', async () => {
      const result = Bun.spawnSync(['terraform', 'plan', '-no-color'], {
        cwd: TEST_DIR,
        env: { ...process.env, TF_IN_AUTOMATION: '1' },
      })

      const output = result.stdout.toString()
      expect(result.exitCode).toBe(0)
      expect(output).toContain('dws_worker')
      expect(output).toContain('dws_container')
      expect(output).toContain('dws_storage')
    })

    test('terraform apply creates infrastructure', async () => {
      const result = Bun.spawnSync(
        ['terraform', 'apply', '-auto-approve', '-no-color'],
        {
          cwd: TEST_DIR,
          env: { ...process.env, TF_IN_AUTOMATION: '1' },
        },
      )

      expect(result.exitCode).toBe(0)

      // Verify outputs were created
      const workerResult = JSON.parse(
        Bun.spawnSync(['cat', 'worker-result.json'], {
          cwd: TEST_DIR,
        }).stdout.toString() || '{}',
      )
      expect(workerResult.id).toBeDefined()
      expect(workerResult.name).toBe('terraform-test-worker')
    })

    test('terraform destroy cleans up infrastructure', async () => {
      const result = Bun.spawnSync(
        ['terraform', 'destroy', '-auto-approve', '-no-color'],
        {
          cwd: TEST_DIR,
          env: { ...process.env, TF_IN_AUTOMATION: '1' },
        },
      )

      expect(result.exitCode).toBe(0)
    })
  })
})
