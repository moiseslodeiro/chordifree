locals {
  server_service_name   = "${var.name_prefix}-server"
  analyzer_service_name = "${var.name_prefix}-analyzer"
  analysis_job_name     = "${var.name_prefix}-analysis"
  server_sa_id          = "${var.name_prefix}-server"
  analyzer_sa_id        = "${var.name_prefix}-analyzer"
  worker_sa_id          = "${var.name_prefix}-worker"
  image_registry        = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repository}"
  server_image          = var.server_image != "" ? var.server_image : "${local.image_registry}/server:latest"
  analyzer_image        = var.analyzer_image != "" ? var.analyzer_image : "${local.image_registry}/analyzer:latest"

  common_labels = merge(var.labels, {
    managed-by = "terraform"
  })
}

# Cloud Run, Cloud Build and Artifact Registry are pay-as-you-go. Firestore has a
# generous free tier. No load balancer or IAP is created on purpose.
resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "firestore.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudtrace.googleapis.com",
    "telemetry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "images" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repository
  description   = "Chordifree server and analyzer images"
  format        = "DOCKER"
  labels        = local.common_labels

  # Keep only a handful of recent versions so the free storage allowance lasts.
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"

    most_recent_versions {
      keep_count = 3
    }
  }

  depends_on = [google_project_service.services]
}

resource "google_firestore_database" "default" {
  project                     = var.project_id
  name                        = var.firestore_database
  location_id                 = var.firestore_location
  type                        = "FIRESTORE_NATIVE"
  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"
  deletion_policy             = "ABANDON"

  depends_on = [google_project_service.services]
}

# Analysis results carry a 90-day expiresAt; Firestore removes them automatically.
resource "google_firestore_field" "analysis_cache_expires" {
  project    = var.project_id
  database   = google_firestore_database.default.name
  collection = "chordifree_analysis"
  field      = "expiresAt"
  ttl_config {}
}

# The administrator activity feed also expires after 90 days.
resource "google_firestore_field" "analysis_log_expires" {
  project    = var.project_id
  database   = google_firestore_database.default.name
  collection = "chordifree_analysis_log"
  field      = "expiresAt"
  ttl_config {}
}

resource "google_firestore_field" "analysis_jobs_expires" {
  project    = var.project_id
  database   = google_firestore_database.default.name
  collection = "chordifree_analysis_jobs"
  field      = "expiresAt"
  ttl_config {}
}

# Per-user daily analysis quotas also expire automatically.
resource "google_firestore_field" "analysis_quota_expires" {
  project    = var.project_id
  database   = google_firestore_database.default.name
  collection = "chordifree_analysis_quota"
  field      = "expiresAt"
  ttl_config {}
}

resource "google_firestore_field" "analysis_inputs_expires" {
  project    = var.project_id
  database   = google_firestore_database.default.name
  collection = "chordifree_analysis_inputs"
  field      = "expiresAt"
  ttl_config {}
}

# Dedicated runtime accounts: the server and worker can write Firestore; both
# can call the private analyzer. The analyzer gets no project roles at all.
resource "google_service_account" "server" {
  project      = var.project_id
  account_id   = local.server_sa_id
  display_name = "Chordifree server"
}

resource "google_service_account" "analyzer" {
  project      = var.project_id
  account_id   = local.analyzer_sa_id
  display_name = "Chordifree analyzer"
}

resource "google_service_account" "analysis_worker" {
  project      = var.project_id
  account_id   = local.worker_sa_id
  display_name = "Chordifree analysis worker"
}

resource "google_project_iam_member" "server_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.server.email}"
}

resource "google_project_iam_member" "server_logs" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.server.email}"
}

resource "google_project_iam_member" "server_trace" {
  project = var.project_id
  role    = "roles/telemetry.writer"
  member  = "serviceAccount:${google_service_account.server.email}"
}

resource "google_project_iam_member" "analyzer_logs" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.analyzer.email}"
}

resource "google_project_iam_member" "analysis_worker_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.analysis_worker.email}"
}

resource "google_project_iam_member" "analysis_worker_logs" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.analysis_worker.email}"
}
