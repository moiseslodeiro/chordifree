# Hosting Chordifree on GCP

This stack runs a private online instance of Chordifree on Google Cloud:

- **Cloud Run** serves the web app and API from a single container (same origin).
- **Cloud Run** runs the Essentia analyzer as a separate, private service.
- **Firestore** stores the Google account allowlist and each user's songs and setlists.
- **Artifact Registry** stores both container images.
- **Google Identity Services** issues an ID token in the browser; the API verifies it with
  `google-auth-library` and checks the email against the allowlist.

There is no load balancer, no IAP and no always-on VM. Both Cloud Run services scale to zero,
so an idle instance costs nothing.

## Why this shape

| Piece | Reason |
| --- | --- |
| Cloud Run (request-driven) | Free tier and scale to zero. No VM to patch. |
| Server serves the SPA | One origin, no CORS/CSP complexity, no extra hosting bill. |
| Google ID token, verified server-side | No IAP (which needs a load balancer and costs money). |
| Firestore native mode | Generous free tier, no SQL instance to keep awake. |
| Analyzer with Cloud Run IAM | Container stays private; only the server service account can call it. |
| One server instance | Jobs and temporary audio live in memory, so a queue must not be split. |

## Cost

The stack is designed to fit the free tier for personal use:

- **Cloud Run** free tier per billing account and month: 180,000 vCPU-seconds,
  360,000 GiB-seconds and 2 million requests. Scaling to zero means idle time is free.
- **Firestore** free tier per project and day: 50,000 reads, 20,000 writes, 20,000 deletes
  and 1 GiB stored.
- **Cloud Build** free tier: 120 build-minutes per day on the default pool.
- **Artifact Registry** free tier: 0.5 GB. The analyzer image is large (models and Python),
  so a few image versions can cost a few cents per month. The repository keeps the last three
  versions; lower `keep_count` in `main.tf` if you want to trim it further.
- **Cloud Logging** free tier: 50 GiB per month.
- **No** load balancer, NAT, Kubernetes or IAP.

Set a billing budget alert anyway (for example 1 EUR) in **Billing → Budgets & alerts**.
A 4 GiB analyzer instance burns memory-seconds faster than the API; an analysis-heavy month
can leave the free tier even if the bill stays small.

The API sets `cpu_idle = false` so background analysis keeps running after the HTTP response
that created the job. Instances still scale to zero after the configured idle period.

## Prerequisites

- A GCP project with billing enabled.
- [`gcloud`](https://cloud.google.com/sdk/docs/install) and
  [`terraform`](https://developer.hashicorp.com/terraform/install) (>= 1.7).
- Permission to create Cloud Run services, Firestore databases, Artifact Registry
  repositories and service accounts in the project.
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
both Cloud Run services. You can also run Terraform directly:

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

## Where data lives

| Data | Location |
| --- | --- |
| Allowlist | Firestore `chordifree_access/{email}` |
| Songs | Firestore `chordifree_users/{uid}/songs/{songId}` |
| Setlists | Firestore `chordifree_users/{uid}/setlists/{setlistId}` |

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
| `ANALYZER_URL` | URL of the analyzer Cloud Run service |
| `ANALYZER_AUTH` | `google` (Cloud Run verifies the ID token) |
| `YOUTUBE_EXTRACTOR_URL` | Optional residential extractor URL |
| `YOUTUBE_EXTRACTOR_TOKEN` | Optional shared extractor token |
| `TEMP_DIR` | `/tmp/chordifree` |
| `TRUST_PROXY` | `1` |
| `AUDIO_CACHE_TTL_MINUTES` | `var.audio_cache_ttl_minutes` |

## Optional: YouTube extractor on a residential IP

YouTube blocks many Cloud Run/datacenter IPs with a “confirm you're not a bot” challenge. If
you want YouTube analysis on the online instance, run the small extractor from
[`services/youtube-extractor`](../../services/youtube-extractor/README.md) on a machine with a
residential IP (a Raspberry Pi is enough) and expose it with Cloudflare Tunnel or Tailscale
Funnel. The analyzer and the library stay in Cloud Run.

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

Local state works for a single operator. For shared state, create a GCS bucket and add a
backend before the first `terraform init`:

```hcl
terraform {
  backend "gcs" {
    bucket = "your-tfstate-bucket"
    prefix = "chordifree"
  }
}
```

Do not commit `terraform.tfstate`; it is already ignored.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Access not enabled` after signing in | The email is not an administrator and not in `chordifree_access`. Add it from `#/admin` with an administrator account. |
| `401` on every API call | `GOOGLE_CLIENT_ID` does not match the OAuth client that issued the token. Redeploy with the right ID. |
| Google button does not appear | The Cloud Run URL is missing from **Authorized JavaScript origins**, or the browser blocked `accounts.google.com` (check the CSP). |
| `Permission denied` calling the analyzer | The server service account is missing `roles/run.invoker` on the analyzer. Re-apply Terraform. |
| Analysis starts but never finishes | The server must keep CPU allocated. Keep `cpu_idle = false` and `max_instance_count = 1`. |
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
