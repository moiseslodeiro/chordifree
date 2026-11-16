variable "project_id" {
  description = "GCP project that hosts Chordifree."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run, Artifact Registry and Firestore."
  type        = string
  default     = "europe-west1"
}

variable "name_prefix" {
  description = "Prefix for the resources created by this stack."
  type        = string
  default     = "chordifree"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.name_prefix))
    error_message = "Use 2-21 lowercase letters, digits or dashes."
  }
}

variable "google_client_id" {
  description = "OAuth 2.0 Web client ID used to verify Google ID tokens."
  type        = string

  validation {
    condition     = endswith(var.google_client_id, ".apps.googleusercontent.com")
    error_message = "Use the Web client ID that ends in .apps.googleusercontent.com."
  }
}

variable "admin_emails" {
  description = "Google accounts that can manage the allowlist. They are always allowed."
  type        = list(string)

  validation {
    condition     = length(var.admin_emails) > 0
    error_message = "Add at least one administrator email."
  }
}

variable "cors_origin" {
  description = "Optional extra browser origin for direct API calls. The web app is served by the server, so it is usually empty."
  type        = string
  default     = ""
}

variable "firestore_location" {
  description = "Firestore location. Keep it close to the Cloud Run region."
  type        = string
  default     = "europe-west1"
}

variable "firestore_database" {
  description = "Firestore database ID. The default database is called (default)."
  type        = string
  default     = "(default)"
}

variable "artifact_repository" {
  description = "Artifact Registry repository name for the container images."
  type        = string
  default     = "chordifree"
}

variable "server_image" {
  description = "Full server image URI. Leave empty to use the default Artifact Registry image with the latest tag."
  type        = string
  default     = ""
}

variable "analyzer_image" {
  description = "Full analyzer image URI. Leave empty to use the default Artifact Registry image with the latest tag."
  type        = string
  default     = ""
}

variable "server_memory" {
  description = "Memory for the API service."
  type        = string
  default     = "2Gi"
}

variable "server_cpu" {
  description = "CPU for the API service."
  type        = string
  default     = "1"
}

variable "analyzer_memory" {
  description = "Memory for the Essentia analyzer. The models are memory hungry."
  type        = string
  default     = "4Gi"
}

variable "analyzer_cpu" {
  description = "CPU for the analyzer service."
  type        = string
  default     = "2"
}

variable "max_duration_seconds" {
  description = "Longest audio track the API accepts."
  type        = number
  default     = 900
}

variable "max_upload_bytes" {
  description = "Largest uploaded audio file."
  type        = number
  default     = 26214400
}

variable "rate_limit_max" {
  description = "Requests per client and window."
  type        = number
  default     = 60
}

variable "audio_cache_ttl_minutes" {
  description = "How long temporary YouTube audio is kept on the instance."
  type        = number
  default     = 60
}

variable "labels" {
  description = "Labels added to billable resources that support them."
  type        = map(string)
  default = {
    app = "chordifree"
  }
}

variable "youtube_extractor_url" {
  description = "Optional URL of a residential YouTube extractor (for example the Raspberry Pi service). Leave empty to use yt-dlp inside Cloud Run."
  type        = string
  default     = ""

  validation {
    condition     = var.youtube_extractor_url == "" || can(regex("^https://", var.youtube_extractor_url))
    error_message = "Use an https:// URL for the YouTube extractor, or leave it empty."
  }
}

variable "youtube_extractor_token" {
  description = "Shared token for the YouTube extractor. Required when youtube_extractor_url is set."
  type        = string
  default     = ""
  sensitive   = true

  validation {
    condition     = var.youtube_extractor_url == "" || var.youtube_extractor_token != ""
    error_message = "Set youtube_extractor_token when youtube_extractor_url is configured."
  }
}
