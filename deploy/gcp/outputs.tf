output "project_id" {
  description = "Project that hosts the stack."
  value       = var.project_id
}

output "service_url" {
  description = "Public URL of the Chordifree web app."
  value       = google_cloud_run_v2_service.server.uri
}

output "analyzer_url" {
  description = "Private URL of the analyzer. Only the server and worker service accounts can call it."
  value       = google_cloud_run_v2_service.analyzer.uri
}

output "artifact_registry" {
  description = "Docker repository for the images."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "firestore_database" {
  description = "Firestore database used for the allowlist and user libraries."
  value       = google_firestore_database.default.name
}

output "server_service_account" {
  description = "Runtime service account of the API."
  value       = google_service_account.server.email
}

output "analyzer_service_account" {
  description = "Runtime service account of the analyzer."
  value       = google_service_account.analyzer.email
}

output "analysis_worker_service_account" {
  description = "Runtime service account of the on-demand analysis Job."
  value       = google_service_account.analysis_worker.email
}
