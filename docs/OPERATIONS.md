# Operations runbook

This is the operator checklist for the optional private online instance. Local/desktop users
do not need any of this.

## Start, stop and redeploy

```bash
cd deploy/gcp

# Rebuild images and recreate/update Cloud Run
./deploy.sh

# Stop Cloud Run only, keeping Firestore and Artifact Registry
terraform destroy \
  -target=google_cloud_run_v2_service_iam_member.server_public \
  -target=google_cloud_run_v2_service_iam_member.analyzer_invoker \
  -target=google_cloud_run_v2_service.server \
  -target=google_cloud_run_v2_service.analyzer
```

A redeploy creates a new Cloud Run URL if the services were deleted. Update the OAuth client's
authorized JavaScript origins when that happens.

## Health

```bash
URL="$(terraform output -raw service_url)"
curl -fsS "$URL/api/health"
curl -fsS "$URL/api/config"
```

`/api/health` checks the analyzer. `/api/config` reports whether the cloud library and the
YouTube extractor are enabled.

## Logs

Job failures are logged with the source and error code:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="chordifree-server" AND textPayload:"[analysis]"' \
  --limit=50 --format='value(timestamp,textPayload)'
```

Other useful filters:

```bash
# Account deletions
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="chordifree-server" AND textPayload:"[account]"' \
  --limit=20 --format='value(timestamp,textPayload)'

# Server errors
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="chordifree-server" AND severity>=ERROR' \
  --limit=50 --format='value(timestamp,textPayload)'

# Analyzer
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="chordifree-analyzer"' \
  --limit=50 --format='value(timestamp,textPayload)'
```

## Metrics, traces and alerts

Terraform creates an email channel, a log-based analysis-failure alert, a Cloud Run 5xx alert
and an uptime check for `/api/health`. Verify the email channel in **Monitoring → Alerting →
Notification channels**.

The server sends OTLP traces to `telemetry.googleapis.com` when `OTEL_ENABLED=true` (the
Terraform default). The service account needs `roles/telemetry.writer`; the stack enables the
Telemetry and Cloud Trace APIs. Open **Trace Explorer** to inspect requests to the API and
outbound calls to the analyzer/extractor.

Useful commands:

```bash
# Active alert policies
gcloud monitoring policies list --project "$(terraform output -raw project_id)" \
  --format='table(displayName,enabled)'

# Recent traces (Trace Explorer link)
echo "https://console.cloud.google.com/traces/list?project=$(terraform output -raw project_id)"
```

## Firestore backup and restore

```bash
cd deploy/gcp

# Export all collections
./backup-firestore.sh gs://your-backup-bucket/chordifree/$(date -u +%Y-%m-%dT%H-%M-%SZ)

# Import (replace the timestamp)
gcloud firestore import gs://your-backup-bucket/chordifree/2026-11-16T18-00-00Z \
  --project "$(terraform output -raw project_id)" \
  --database "$(terraform output -raw firestore_database)"
```

The bucket needs a lifecycle policy. Firestore exports require the import/export permissions.

## Terraform state

Use a GCS backend for anything beyond a single operator:

```bash
cp backend.tf.example backend.tf
# edit bucket
terraform init -migrate-state
```

Keep `terraform.tfstate`, `terraform.tfvars` and `backend.tf` out of Git. They can contain the
OAuth client ID, administrator emails and the extractor token.

## YouTube extractor

On the Pi:

```bash
sudo systemctl status chordifree-extractor
sudo journalctl -u chordifree-extractor -f
curl -fsS http://127.0.0.1:8010/health
```

If it is offline, YouTube analysis fails with `EXTRACTOR_UNAVAILABLE`; audio uploads still
work. Rotate `EXTRACTOR_TOKEN` in `/etc/chordifree-extractor.env` and `terraform.tfvars`, then
restart the Pi service and re-apply Terraform.

## Access and OAuth

- Add/remove accounts in `#/admin`. Administrators come from `ADMIN_EMAILS`.
- Removing an account blocks future sign-ins but does not delete its library.
- Users can delete their own cloud library from the account menu.
- Keep the OAuth authorized JavaScript origins in sync with the Cloud Run/custom-domain URL.
- If the OAuth consent screen is in Testing, add every allowed account as a test user.

## Cost and budget

- Check **Billing → Budgets & alerts** and the Cloud Run metrics.
- Cloud Run scales to zero, but the server uses `cpu_idle = false` while an instance is alive.
- Artifact Registry keeps the last three images. Lower `keep_count` in `main.tf` if needed.
- Stop Cloud Run when the instance will not be used for a while.

## Incident checklist

1. Check `/api/health` and `/api/config`.
2. Check the server and analyzer logs with the filters above.
3. If only YouTube fails, inspect the extractor or use audio upload.
4. If authentication fails, verify the OAuth origin, client ID and allowlist.
5. If Firestore fails, check quotas, IAM and the database name.
6. Before destructive changes, export Firestore and back up the Terraform state.
