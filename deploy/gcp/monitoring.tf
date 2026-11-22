locals {
  alert_email = var.alert_email != "" ? var.alert_email : var.admin_emails[0]
}

resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = "${var.name_prefix} alerts"
  type         = "email"
  labels = {
    email_address = local.alert_email
  }
}

resource "google_logging_metric" "analysis_failures" {
  project = var.project_id
  name    = "${replace(var.name_prefix, "-", "_")}_analysis_failures"
  filter  = "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"${local.analysis_job_name}\" AND textPayload:\"[analysis-worker]\" AND textPayload:\"failed\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_monitoring_alert_policy" "analysis_failures" {
  project      = var.project_id
  display_name = "${var.name_prefix}: analysis failures"
  combiner     = "OR"
  severity     = "ERROR"
  enabled      = true

  conditions {
    display_name = "Failed analysis jobs"
    condition_matched_log {
      filter = "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"${local.analysis_job_name}\" AND textPayload:\"[analysis-worker]\" AND textPayload:\"failed\""
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  documentation {
    mime_type = "text/markdown"
    content   = "At least one analysis job failed in the last 5 minutes. Check the Cloud Run Job worker logs for `[analysis-worker]` and the error code (for example `VIDEO_UNAVAILABLE`, `YOUTUBE_BLOCKED`, `EXTRACTOR_UNAVAILABLE` or `ANALYSIS_FAILED`)."
  }
}

resource "google_monitoring_alert_policy" "server_5xx" {
  project      = var.project_id
  display_name = "${var.name_prefix}: Cloud Run 5xx rate"
  combiner     = "OR"
  severity     = "ERROR"
  enabled      = true

  conditions {
    display_name = "Cloud Run server 5xx responses"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${local.server_service_name}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.5
      duration        = "300s"

      trigger {
        count = 1
      }

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  documentation {
    mime_type = "text/markdown"
    content   = "The Cloud Run server is returning 5xx responses. Check `/api/health`, the Cloud Run logs and Firestore/extractor availability."
  }
}

resource "google_monitoring_uptime_check_config" "server" {
  project      = var.project_id
  display_name = "${var.name_prefix} health"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/api/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      host = replace(google_cloud_run_v2_service.server.uri, "https://", "")
    }
  }
}

resource "google_monitoring_alert_policy" "uptime" {
  project      = var.project_id
  display_name = "${var.name_prefix}: health check"
  combiner     = "OR"
  severity     = "ERROR"
  enabled      = true

  conditions {
    display_name = "Health check failing"
    condition_threshold {
      filter          = "resource.type=\"uptime_url\" AND metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id=\"${google_monitoring_uptime_check_config.server.uptime_check_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "300s"

      trigger {
        count = 1
      }

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_FRACTION_TRUE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  documentation {
    mime_type = "text/markdown"
    content   = "The public `/api/health` check has been failing for 5 minutes. Check the Cloud Run service, the analyzer and the latest revision."
  }
}
