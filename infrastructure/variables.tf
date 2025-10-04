variable "do_token" {
  description = "DigitalOcean API Token"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

variable "root_password" {
  description = "Root password for the droplet (minimum 8 characters)"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.root_password) >= 8
    error_message = "Root password must be at least 8 characters long."
  }
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "videocopilot"
}