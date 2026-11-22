resource "google_cloud_run_v2_service" "analyzer" {
  project             = var.project_id
  name                = local.analyzer_service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  labels              = local.common_labels

  template {
    service_account = google_service_account.analyzer.email
    timeout         = "900s"

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      name  = "analyzer"
      image = local.analyzer_image

      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = var.analyzer_cpu
          memory = var.analyzer_memory
        }
        # The analyzer always answers inside the request, so CPU can be
        # throttled between requests.
        cpu_idle = true
      }

      env {
        name  = "ANALYZER_VERSION"
        value = "essentia-1.6"
      }

      env {
        name  = "ANALYZER_DOWNLOAD_MODELS"
        value = "0"
      }

      startup_probe {
        initial_delay_seconds = 10
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 12

        http_get {
          path = "/health"
          port = 8000
        }
      }
    }
  }

  depends_on = [
    google_project_service.services,
    google_artifact_registry_repository.images,
  ]
}

# Only the server and analysis worker service accounts may call the analyzer.
# Cloud Run verifies the ID token before the request reaches the container.
resource "google_cloud_run_v2_service_iam_member" "analyzer_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.analyzer.location
  name     = google_cloud_run_v2_service.analyzer.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.server.email}"
}

resource "google_cloud_run_v2_service_iam_member" "analyzer_worker_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.analyzer.location
  name     = google_cloud_run_v2_service.analyzer.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.analysis_worker.email}"
}

resource "google_cloud_run_v2_service" "server" {
  project             = var.project_id
  name                = local.server_service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  labels              = local.common_labels

  template {
    service_account = google_service_account.server.email
    timeout         = "900s"

    scaling {
      min_instance_count = 0
      # The temporary playback cache is instance-local; a single API instance
      # keeps it consistent while analysis jobs run independently in Firestore.
      max_instance_count = 1
    }

    containers {
      name  = "server"
      image = local.server_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.server_cpu
          memory = var.server_memory
        }
        # Analysis runs in the separate Cloud Run Job, so the API only needs CPU
        # while it is handling requests and can use request-based billing.
        cpu_idle = true
      }

      env {
        name  = "HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "TRUST_PROXY"
        value = "1"
      }

      env {
        name  = "OTEL_ENABLED"
        value = "true"
      }

      env {
        name  = "OTEL_SERVICE_NAME"
        value = local.server_service_name
      }

      env {
        name  = "TEMP_DIR"
        value = "/tmp/chordifree"
      }

      env {
        name  = "MAX_DURATION_SECONDS"
        value = tostring(var.max_duration_seconds)
      }

      env {
        name  = "MAX_UPLOAD_BYTES"
        value = tostring(var.max_upload_bytes)
      }

      env {
        name  = "RATE_LIMIT_MAX"
        value = tostring(var.rate_limit_max)
      }

      env {
        name  = "AUDIO_CACHE_TTL_MINUTES"
        value = tostring(var.audio_cache_ttl_minutes)
      }

      env {
        name  = "AUTH_MODE"
        value = "google"
      }

      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }

      env {
        name  = "ADMIN_EMAILS"
        value = join(",", var.admin_emails)
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "FIRESTORE_DATABASE"
        value = var.firestore_database
      }

      env {
        name  = "CLOUD_RUN_REGION"
        value = var.region
      }

      env {
        name  = "ANALYSIS_JOB_NAME"
        value = google_cloud_run_v2_job.analysis.name
      }

      env {
        name  = "ANALYZER_URL"
        value = google_cloud_run_v2_service.analyzer.uri
      }

      env {
        name  = "ANALYZER_AUTH"
        value = "google"
      }

      dynamic "env" {
        for_each = var.youtube_extractor_url == "" ? [] : [1]
        content {
          name  = "YOUTUBE_EXTRACTOR_URL"
          value = var.youtube_extractor_url
        }
      }

      dynamic "env" {
        for_each = var.youtube_extractor_url == "" ? [] : [1]
        content {
          name  = "YOUTUBE_EXTRACTOR_TOKEN"
          value = var.youtube_extractor_token
        }
      }

      dynamic "env" {
        for_each = var.cors_origin != "" ? [var.cors_origin] : []
        content {
          name  = "CORS_ORIGIN"
          value = env.value
        }
      }

      startup_probe {
        initial_delay_seconds = 5
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 12

        http_get {
          path = "/api/health"
          port = 8080
        }
      }
    }
  }

  depends_on = [
    google_project_service.services,
    google_artifact_registry_repository.images,
    google_firestore_database.default,
    google_cloud_run_v2_service.analyzer,
    google_cloud_run_v2_service_iam_member.analyzer_invoker,
    google_cloud_run_v2_job_iam_member.analysis_executor,
    google_service_account_iam_member.server_can_run_analysis_worker,
  ]
}

# The app is public at the network level because Google Identity Services runs
# in the browser. The Express server rejects every account that is not in the
# allowlist, so this is not an open instance.
resource "google_cloud_run_v2_service_iam_member" "server_public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.server.location
  name     = google_cloud_run_v2_service.server.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
