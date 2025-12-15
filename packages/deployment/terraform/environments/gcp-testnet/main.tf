# Jeju Network - GCP Testnet Environment
# Complete infrastructure on Google Cloud Platform

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.35"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.17"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "gcs" {
    bucket = "jeju-terraform-state-testnet"
    prefix = "terraform/state"
  }
}

# ============================================================
# Variables
# ============================================================
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "domain_name" {
  description = "Base domain name"
  type        = string
  default     = "jeju.network"
}

locals {
  environment = "testnet"
  common_labels = {
    project     = "jeju-network"
    environment = "testnet"
    managed_by  = "terraform"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ============================================================
# Module: Network (VPC, Subnets, NAT)
# ============================================================
module "network" {
  source = "../../modules/gcp-network"

  project_id  = var.project_id
  environment = local.environment
  region      = var.region
  vpc_cidr    = "10.1.0.0/16"
}

# ============================================================
# Module: GKE Cluster
# ============================================================
module "gke" {
  source = "../../modules/gcp-gke"

  project_id          = var.project_id
  environment         = local.environment
  region              = var.region
  network_name        = module.network.network_name
  subnet_name         = module.network.private_subnet_name
  pods_range_name     = module.network.pods_range_name
  services_range_name = module.network.services_range_name
  cluster_version     = "1.29"

  node_pools = [
    {
      name          = "general"
      machine_type  = "e2-standard-4"
      min_count     = 2
      max_count     = 10
      disk_size_gb  = 50
      disk_type     = "pd-standard"
      preemptible   = false
      labels        = { workload = "general" }
      taints        = []
    },
    {
      name          = "rpc"
      machine_type  = "e2-standard-8"
      min_count     = 1
      max_count     = 5
      disk_size_gb  = 100
      disk_type     = "pd-ssd"
      preemptible   = false
      labels        = { workload = "rpc" }
      taints = [{
        key    = "workload"
        value  = "rpc"
        effect = "NO_SCHEDULE"
      }]
    },
    {
      name          = "indexer"
      machine_type  = "e2-standard-4"
      min_count     = 1
      max_count     = 4
      disk_size_gb  = 100
      disk_type     = "pd-standard"
      preemptible   = true # Cost savings for non-critical workloads
      labels        = { workload = "indexer" }
      taints        = []
    }
  ]

  depends_on = [module.network]
}

# ============================================================
# Module: Cloud SQL (PostgreSQL)
# ============================================================
module "cloudsql" {
  source = "../../modules/gcp-sql"

  project_id        = var.project_id
  environment       = local.environment
  region            = var.region
  network_id        = module.network.network_id
  tier              = "db-custom-2-4096"
  disk_size         = 100
  high_availability = true
  backup_enabled    = true

  depends_on = [module.network]
}

# ============================================================
# Module: Artifact Registry (Container Registry)
# ============================================================
module "artifact_registry" {
  source = "../../modules/gcp-artifact-registry"

  project_id  = var.project_id
  environment = local.environment
  region      = var.region
}

# ============================================================
# Kubernetes Provider Configuration
# ============================================================
data "google_client_config" "default" {}

provider "kubernetes" {
  host                   = "https://${module.gke.cluster_endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(module.gke.cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = "https://${module.gke.cluster_endpoint}"
    token                  = data.google_client_config.default.access_token
    cluster_ca_certificate = base64decode(module.gke.cluster_ca_certificate)
  }
}

# ============================================================
# Outputs
# ============================================================
output "gke_cluster_name" {
  description = "GKE cluster name"
  value       = module.gke.cluster_name
}

output "gke_cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = module.gke.cluster_endpoint
}

output "cloudsql_connection_name" {
  description = "Cloud SQL connection name"
  value       = module.cloudsql.connection_name
}

output "cloudsql_private_ip" {
  description = "Cloud SQL private IP"
  value       = module.cloudsql.private_ip
}

output "registry_url" {
  description = "Artifact Registry URL"
  value       = module.artifact_registry.registry_url
}

output "deployment_summary" {
  description = "Complete deployment summary"
  value = {
    environment  = local.environment
    project      = var.project_id
    region       = var.region
    gke_cluster  = module.gke.cluster_name
    cloudsql     = module.cloudsql.connection_name
    registry     = module.artifact_registry.registry_url
  }
}

output "next_steps" {
  description = "Post-deployment instructions"
  value       = <<-EOT
    ═══════════════════════════════════════════════════════════════════
    GCP DEPLOYMENT COMPLETE - Next Steps:
    ═══════════════════════════════════════════════════════════════════
    
    1. Configure kubectl:
       gcloud container clusters get-credentials ${module.gke.cluster_name} \
         --region ${var.region} --project ${var.project_id}
    
    2. Configure Docker for Artifact Registry:
       gcloud auth configure-docker ${var.region}-docker.pkg.dev
    
    3. Build and push images:
       docker build -t ${module.artifact_registry.image_prefix}/gateway:latest .
       docker push ${module.artifact_registry.image_prefix}/gateway:latest
    
    4. Deploy applications:
       cd packages/deployment && NETWORK=testnet bun run scripts/helmfile.ts sync
    
    5. Cloud SQL Proxy (for local access):
       cloud-sql-proxy ${module.cloudsql.connection_name}
    ═══════════════════════════════════════════════════════════════════
  EOT
}
