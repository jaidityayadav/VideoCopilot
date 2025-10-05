# variables.tf
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "instance_name" {
  description = "Name tag for the EC2 instance"
  type        = string
  default     = "videocopilot-instance"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "m7i-flex.large"
}

variable "ami_id" {
  description = "AMI ID for the EC2 instance"
  type        = string
  default     = "ami-052064a798f08f0d3"
}

variable "key_name" {
  description = "Name of the AWS key pair"
  type        = string
  default     = "devops"
}