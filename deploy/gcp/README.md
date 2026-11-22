# Hosting Chordifree on GCP

This stack runs a private online instance of Chordifree on Google Cloud:

- **Cloud Run** serves the web app and API from a single container (same origin).
- **Cloud Run** runs the Essentia analyzer as a separate, private service.
- **Cloud Run Jobs** run analyses on demand; Firestore persists their status and temporarily
  stores uploaded audio in bounded chunks.
- **Firestore** stores the Google account allowlist, each user's songs and setlists, and analysis jobs.
- **Artifact Registry** stores both container images.
- **Google Identity Services** issues an ID token in the browser; the API verifies it with
  `google-auth-library` and checks the email against the allowlist.

There is no load balancer, no IAP and no always-on VM. The API and analyzer scale to zero;
analysis Jobs run only when requested.

## Why this shape

| Piece | Reason |
| --- | --- |
| Cloud Run API (request-driven) | Scales to zero and does not keep CPU allocated between requests. |
| Cloud Run Jobs | Run analyses only when requested, then stop. |
| Server serves the SPA | One origin, no CORS/CSP complexity, no extra hosting bill. |
| Google ID token, verified server-side | No IAP (which needs a load balancer and costs money). |
| Firestore native mode | Generous free tier, no SQL instance to keep awake. |
| Analyzer with Cloud Run IAM | Container stays private; only the API and worker service accounts can call it. |
| Firestore job state | Job status survives scale-to-zero and is visible to every API instance. |

## Cost

The stack is designed to fit the free tier for personal use:

- **Cloud Run** free tier is aggregated per billing account and month. Services using
  request-based billing include 180,000 vCPU-seconds, 360,000 GiB-seconds and 2 million
  requests; Jobs use instance-based free-tier rates. Capacity is shared with other Cloud Run
  usage on the billing account.
- **Firestore** free tier per project and day: 50,000 reads, 20,000 writes, 20,000 deletes
  and 1 GiB stored.
- **Cloud Build** free tier: 120 build-minutes per day on the default pool.
- **Artifact Registry** free tier: 0.5 GB. The analyzer image is large (models and Python),
  so a few image versions can cost a few cents per month. The repository keeps the last three
  versions; lower `keep_count` in `main.tf` if you want to trim it further.
- **Cloud Logging** free tier: 50 GiB per month.
- **No** load balancer, NAT, Kubernetes or IAP.

Set a billing budget or spend cap in **Billing → Budgets & alerts**. Jobs still consume CPU and
memory while processing, so heavy analysis usage can exceed the free tier. A spend cap can pause
Cloud Run; an alert alone does not stop charges.

The API uses request-based billing. It writes upload chunks and job state to Firestore, then
starts a Cloud Run Job. The worker reads the job, performs the analysis, writes the result and
cleans up temporary upload chunks. Firestore TTL policies remove abandoned job/input records.

## Prerequisites

- A GCP project with billing enabled.
- [`gcloud`](https://cloud.google.com/sdk/docs/install) and
  [`terraform`](https://developer.hashicorp.com/terraform/install) (>= 1.7).
- Permission to create Cloud Run services and Jobs, Firestore databases, Artifact Registry
  repositories, IAM bindings and service accounts in the project.
- A Google account that will be the first administrator.

Authenticate locally:

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

Terraform uses Application Default Credentials.

## 1. Create the OAuth client

1. In **APIs & Services → OAuth consent screen**, choose **External** (or **Internal** for a
   Workspace organization) and fill in the app name and support email. For a private instance,
   **Testing** is enough; add your accounts as test users. Publishing is only needed if you
   do not want the "unverified app" warning.
2. In **APIs & Services → Credentials → Create credentials → OAuth client ID**, choose
   **Web application**.
3. Add an **Authorized JavaScript origin** for the Cloud Run URL once you know it. You can
   create the client first and edit the origin after the first deploy.
4. Copy the client ID (it ends in `.apps.googleusercontent.com`). The client secret is **not**
   used by this flow.

The ID token flow does not need an authorized redirect URI.

## 2. Configure Terraform

```bash
cd deploy/gcp
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
project_id         = "your-project"
region             = "europe-west1"
firestore_location = "europe-west1"
google_client_id   = "000000000000-xxxx.apps.googleusercontent.com"
admin_emails       = ["you@example.com"]
```

`admin_emails` bootstraps the administrators. Administrators are always allowed and can open
`#/admin` to add or remove other accounts.

## 3. Deploy

```bash
./deploy.sh
```

The script:

1. runs `terraform init`;
2. creates the Artifact Registry repository (and enables the required APIs);
3. builds and pushes the server and analyzer images with Cloud Build, tagged with the short
   Git commit;
4. applies the full stack and prints the public URL.

On the first run, add the printed URL to the OAuth client's **Authorized JavaScript origins**.
It looks like `https://chordifree-server-xxxxxxxx-ew.a.run.app`. Wait a couple of minutes for
the change to propagate, then open the URL and sign in.

To deploy a new commit, run `./deploy.sh` again. Each run pushes a new image tag and updates
the two services and the analysis Job. You can also run Terraform directly:

```bash
terraform plan
terraform apply
```

If you run `terraform apply` without the image variables, Terraform falls back to the
`:latest` tag declared in `locals`, which may not match what was deployed. Prefer the script.

## 4. Manage access

- The first sign-in must use an address in `admin_emails`.
- Open **Administration** in the account menu (`#/admin`) to allow or remove Google accounts.
- The allowlist lives in Firestore: `chordifree_access/{email}`.
- Removing an account does not delete its library; it only blocks future sign-ins.
- Administrators are always allowed even if they are not in `chordifree_access`.
- Users can delete their own cloud library from the account menu. A non-administrator also
  loses allowlist access; the local copy stays on their device.

## Where data lives

| Data | Location |
| --- | --- |
| Allowlist | Firestore `chordifree_access/{email}` |
| Songs | Firestore `chordifree_users/{uid}/songs/{songId}` |
| Setlists | Firestore `chordifree_users/{uid}/setlists/{setlistId}` |
| Analysis jobs | Firestore `chordifree_analysis_jobs/{jobId}` (24-hour TTL) |
| Temporary upload chunks | Firestore `chordifree_analysis_inputs/{jobId}_{chunk}` (24-hour TTL) |

The browser keeps a local copy and merges it with the cloud snapshot by song source and
`updatedAt` when you sign in. The API uses the Firestore Admin SDK, so Firestore security
rules do not apply to it; do not expose Firestore directly to the browser.

Removing the stack with `terraform destroy` leaves the Firestore database in place
(`deletion_policy = "ABANDON"`) so libraries are not deleted by accident. Delete it manually
if you really want to start over.

## Environment variables wired by Terraform

| Variable | Value |
| --- | --- |
| `AUTH_MODE` | `google` |
| `GOOGLE_CLIENT_ID` | `var.google_client_id` |
| `ADMIN_EMAILS` | `var.admin_emails` |
| `GOOGLE_CLOUD_PROJECT` | `var.project_id` |
| `FIRESTORE_DATABASE` | `var.firestore_database` |
| `CLOUD_RUN_REGION` | `var.region` |
| `ANALYSIS_JOB_NAME` | Cloud Run analysis Job created by Terraform |
| `ANALYZER_URL` | URL of the analyzer Cloud Run service |
| `ANALYZER_AUTH` | `google` (Cloud Run verifies the ID token) |
| `YOUTUBE_EXTRACTOR_URL` | Optional residential extractor URL |
| `YOUTUBE_EXTRACTOR_TOKEN` | Optional shared extractor token |
| `TEMP_DIR` | `/tmp/chordifree` |
| `TRUST_PROXY` | `1` |
| `AUDIO_CACHE_TTL_MINUTES` | `var.audio_cache_ttl_minutes` |
| `OTEL_ENABLED` | `true` (traces to Google Cloud) |
| `OTEL_SERVICE_NAME` | `chordifree-server` |

## Optional: YouTube extractor on a residential IP

YouTube blocks many Cloud Run/datacenter IPs with a “confirm you're not a bot” challenge. If
you want YouTube analysis on the online instance, run the small extractor from
[`services/youtube-extractor`](../../services/youtube-extractor/README.md) on a machine with a
residential IP (a Raspberry Pi is enough) and expose it with Cloudflare Tunnel or Tailscale
Funnel. The analyzer and the library stay in Cloud Run.

On the Pi:

```bash
cd services/youtube-extractor
sudo ./install.sh
# or with Docker:
cp .env.example .env   # set EXTRACTOR_TOKEN
docker compose up -d --build
```

The native installer sets up systemd with `Restart=on-failure`; the Compose file uses
`restart: unless-stopped`. Both bind the service to `127.0.0.1:8010`. See the
[extractor guide](../../services/youtube-extractor/README.md) for the tunnel commands.

```text
Browser -> Cloud Run (web + API + analyzer)
                  |
                  +-> residential extractor -> yt-dlp -> YouTube
```

Set both Terraform variables:

```hcl
youtube_extractor_url   = "https://extractor.example.com"
youtube_extractor_token = "..." # same value as EXTRACTOR_TOKEN on the Pi
```

The token is sensitive and is passed to the server as `YOUTUBE_EXTRACTOR_TOKEN`. If the URL is
empty, the server uses the local `yt-dlp` as before. If the extractor is offline, YouTube
analysis fails with a clear error but audio uploads keep working.

## Optional: custom domain

Map a domain in **Cloud Run → the server service → Custom domains**. Then add
`https://your.domain` to the OAuth authorized JavaScript origins. No extra infrastructure is
required.

## Optional: remote Terraform state

Local state works for a single operator. For durable or shared state, create a GCS bucket
with versioning enabled and copy the backend example before the first `terraform init`:

```bash
gsutil mb -l europe-west1 gs://your-tfstate-bucket
gsutil versioning set on gs://your-tfstate-bucket
cp backend.tf.example backend.tf
# edit the bucket name
terraform init -migrate-state
```

Do not commit `terraform.tfstate` or `backend.tf`; both are ignored.

## Firestore backup

The stack does not schedule backups. Export the database before risky changes and keep the
exports in a bucket with a lifecycle/retention policy:

```bash
./backup-firestore.sh gs://your-backup-bucket/chordifree/$(date -u +%Y-%m-%dT%H-%M-%SZ)
```

This requires the Firestore import/export permissions and write access to the bucket. Restore
with `gcloud firestore import` from the same prefix.

## Monitoring and traces

Terraform creates:

- an email notification channel for `alert_email` (defaults to the first administrator);
- a log-based alert for failed analysis jobs (`[analysis-worker] ... failed`);
- an alert when the Cloud Run server returns 5xx responses;
- an uptime check and alert for `/api/health`.

Verify the email channel in **Monitoring → Alerting → Notification channels**; Google sends a
confirmation email before it delivers alerts.

Cloud Run sends OTLP traces to the Google Cloud Telemetry API
(`telemetry.googleapis.com`). The server service account has `roles/telemetry.writer`, and the
Terraform stack enables the Telemetry and Cloud Trace APIs. Tracing is optional locally:

```bash
OTEL_ENABLED=true GOOGLE_CLOUD_PROJECT=your-project pnpm --filter @chordifree/server start
```

Traces are visible in **Trace Explorer**. OTLP traces through the Telemetry API have a free
tier; check the current Cloud Trace pricing before sending high volume.

## Stopping Cloud Run

The API and analyzer scale to zero; the analysis Job only runs when requested. To remove the
Cloud Run resources while keeping Firestore, Artifact Registry and the service accounts:

```bash
terraform destroy \
  -target=google_cloud_run_v2_service_iam_member.server_public \
  -target=google_cloud_run_v2_service_iam_member.analyzer_invoker \
  -target=google_cloud_run_v2_service_iam_member.analyzer_worker_invoker \
  -target=google_cloud_run_v2_job_iam_member.analysis_executor \
  -target=google_service_account_iam_member.server_can_run_analysis_worker \
  -target=google_cloud_run_v2_job.analysis \
  -target=google_cloud_run_v2_service.server \
  -target=google_cloud_run_v2_service.analyzer
```

To bring them back, run `./deploy.sh` again. It rebuilds the images and recreates the services
and Job. The Firestore database and the user libraries are untouched.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Access not enabled` after signing in | The email is not an administrator and not in `chordifree_access`. Add it from `#/admin` with an administrator account. |
| `401` on every API call | `GOOGLE_CLIENT_ID` does not match the OAuth client that issued the token. Redeploy with the right ID. |
| Google button does not appear | The Cloud Run URL is missing from **Authorized JavaScript origins**, or the browser blocked `accounts.google.com` (check the CSP). |
| `Permission denied` calling the analyzer | The API or worker service account is missing `roles/run.invoker` on the analyzer. Re-apply Terraform. |
| Analysis starts but never finishes | Check the Cloud Run Job execution and worker logs, then confirm the worker can invoke the private analyzer. |
| `YOUTUBE_BLOCKED`, or yt-dlp says “Sign in to confirm you're not a bot” | YouTube blocks many datacenter/Cloud Run IP ranges. Use the audio-upload option; cookies or a proxy can work but are fragile and may violate YouTube's terms. |
| Firestore `RESOURCE_EXHAUSTED` | Daily free-tier quota reached, or a very large import. Wait or raise the quota/billing. |
| Cloud Run revision fails to start | Check logs. Firestore may not be ready yet; re-run `terraform apply`. |

## Local development with the same auth

To exercise Google auth locally, create a second OAuth client (or add
`http://localhost:5173` as an authorized origin) and run:

```bash
AUTH_MODE=google \
GOOGLE_CLIENT_ID=...apps.googleusercontent.com \
ADMIN_EMAILS=you@example.com \
GOOGLE_CLOUD_PROJECT=your-project \
pnpm dev
```

Firestore is used as soon as `AUTH_MODE=google`, so authenticate with
`gcloud auth application-default login`. Local mode (`AUTH_MODE=none`, the default) keeps
working without Google or Firestore.
