# Configure the AWS Provider
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Get the default VPC
data "aws_vpc" "default" {
  default = true
}

# Security Group
resource "aws_security_group" "videocopilot_sg" {
  name        = "videocopilot-security-group"
  description = "Security group for VideoCopilot application"
  vpc_id      = data.aws_vpc.default.id


  # Allow all inbound traffic (all ports, all protocols)
  ingress {
    description = "Allow all inbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }


  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "videocopilot-sg"
  }
}

# EC2 Instance
resource "aws_instance" "videocopilot_instance" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name              = var.key_name
  vpc_security_group_ids = [aws_security_group.videocopilot_sg.id]

  # Enable detailed monitoring
  monitoring = true

  # Root block device configuration
  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  tags = {
    Name = var.instance_name
  }
}
