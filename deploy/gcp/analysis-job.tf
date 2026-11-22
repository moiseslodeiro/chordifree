resource "google_cloud_run_v2_job" "analysis" {
  project  = var.project_id
  name     = local.analysis_job_name
  location = var.region
  labels   = local.common_labels

  template {
    parallelism = 1
    task_count  = 1

    template {
      service_account = google_service_account.analysis_worker.email
      timeout         = "1800s"
      max_retries     = 0

      containers {
        name    = "worker"
        image   = local.server_image
        command = ["pnpm"]
        args    = ["--filter", "@chordifree/server", "run", "worker"]

        resources {
          limits = {
            cpu    = var.server_cpu
            memory = var.server_memory
          }
        }

        env {
          name  = "AUTH_MODE"
          value = "google"
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
          name  = "TEMP_DIR"
          value = "/tmp/chordifree"
        }

        env {
          name  = "MAX_DURATION_SECONDS"
          value = tostring(var.max_duration_seconds)
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
      }
    }
  }

  depends_on = [
    google_project_service.services,
    google_cloud_run_v2_service.analyzer,
    google_cloud_run_v2_service_iam_member.analyzer_worker_invoker,
    google_project_iam_member.analysis_worker_firestore,
  ]
}

resource "google_cloud_run_v2_job_iam_member" "analysis_executor" {
  project  = var.project_id
  location = google_cloud_run_v2_job.analysis.location
  name     = google_cloud_run_v2_job.analysis.name
  role     = "roles/run.jobsExecutorWithOverrides"
  member   = "serviceAccount:${google_service_account.server.email}"
}

resource "google_service_account_iam_member" "server_can_run_analysis_worker" {
  service_account_id = google_service_account.analysis_worker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.server.email}"
}
