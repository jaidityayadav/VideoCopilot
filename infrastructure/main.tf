terraform {
  required_version = ">= 1.0"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

# Password authentication will be used instead of SSH keys
# Root password will be set via cloud-init

# VPC for network isolation
resource "digitalocean_vpc" "videocopilot" {
  name     = "videocopilot-vpc"
  region   = var.region
  ip_range = "10.10.0.0/16"
}

# DigitalOcean Droplet - 4GB / 2vCPU / Premium Intel
resource "digitalocean_droplet" "videocopilot" {
  image     = "ubuntu-22-04-x64"
  name      = "videocopilot-server"
  region    = var.region
  size      = "s-2vcpu-4gb"  # 2 vCPU, 4GB RAM, Premium Intel
  
  vpc_uuid = digitalocean_vpc.videocopilot.id
  
  # No SSH keys - using password authentication
  # ssh_keys = []
  
  user_data = templatefile("${path.module}/cloud-init.yml", {
    root_password = var.root_password
  })
  
  tags = ["videocopilot", "k8s-node"]
  
  # Note: cloud-init will handle initial setup
  # Remote execution will be handled by Ansible using password authentication
}

# Firewall rules
resource "digitalocean_firewall" "videocopilot" {
  name = "videocopilot-firewall"
  
  droplet_ids = [digitalocean_droplet.videocopilot.id]
  
  # SSH
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  # HTTP
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  # Kubernetes API Server
  inbound_rule {
    protocol         = "tcp"
    port_range       = "6443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  # NodePort Services
  inbound_rule {
    protocol         = "tcp"
    port_range       = "30000-32767"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  # Jenkins
  inbound_rule {
    protocol         = "tcp"
    port_range       = "8080"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  # Grafana
  inbound_rule {
    protocol         = "tcp"
    port_range       = "3000"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  # All outbound traffic
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# Load balancer for high availability (optional for future scaling)
resource "digitalocean_loadbalancer" "videocopilot" {
  name   = "videocopilot-lb"
  region = var.region
  
  vpc_uuid = digitalocean_vpc.videocopilot.id
  
  forwarding_rule {
    entry_protocol  = "http"
    entry_port      = 80
    target_protocol = "http"
    target_port     = 30080
  }
  
  healthcheck {
    protocol = "http"
    port     = 30080
    path     = "/health"
  }
  
  droplet_ids = [digitalocean_droplet.videocopilot.id]
}