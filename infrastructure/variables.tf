variable "aws_region" {
  description = "AWS region"
  default     = "us-east-1"
}

variable "cluster_name" {
  default = "my-eks-cluster"
}

variable "node_group_size" {
  default = 4
}

variable "node_instance_type" {
  default = "t3.medium"
}