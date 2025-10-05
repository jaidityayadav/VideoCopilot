# outputs.tf
output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.videocopilot_instance.id
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.videocopilot_instance.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.videocopilot_instance.public_dns
}

output "instance_private_ip" {
  description = "Private IP address of the EC2 instance"
  value       = aws_instance.videocopilot_instance.private_ip
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.videocopilot_sg.id
}

output "ssh_connection_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i ~/.ssh/devops.pem ec2-user@${aws_instance.videocopilot_instance.public_ip}"
}