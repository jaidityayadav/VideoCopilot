output "droplet_ip" {
  description = "Public IP address of the VideoCopilot droplet"
  value       = digitalocean_droplet.videocopilot.ipv4_address
}

output "droplet_private_ip" {
  description = "Private IP address of the VideoCopilot droplet"
  value       = digitalocean_droplet.videocopilot.ipv4_address_private
}

output "droplet_id" {
  description = "ID of the VideoCopilot droplet"
  value       = digitalocean_droplet.videocopilot.id
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = digitalocean_vpc.videocopilot.id
}

output "load_balancer_ip" {
  description = "IP address of the load balancer"
  value       = digitalocean_loadbalancer.videocopilot.ip
}

output "ssh_connection" {
  description = "SSH connection command"
  value       = "ssh root@${digitalocean_droplet.videocopilot.ipv4_address}"
}

output "ansible_inventory" {
  description = "Ansible inventory entry"
  sensitive = true
  value = <<EOF
[videocopilot]
${digitalocean_droplet.videocopilot.ipv4_address} ansible_user=root ansible_ssh_pass=${var.root_password}
EOF
}