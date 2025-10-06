module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "4.0.0"

  name = "eks-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true
}

module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  version         = "19.0.0"  # Example, choose latest compatible

  cluster_name    = var.cluster_name
  cluster_version = "1.28"

  subnets         = module.vpc.private_subnets
  vpc_id          = module.vpc.vpc_id

  node_groups = {
    eks_nodes = {
      desired_capacity = var.node_group_size
      max_capacity     = var.node_group_size
      min_capacity     = var.node_group_size

      instance_type = var.node_instance_type
      key_name      = var.key_name

      additional_security_group_ids = [module.vpc.default_security_group_id]
    }
  }
}

