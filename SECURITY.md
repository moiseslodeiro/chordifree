# Security policy

## Supported versions

Security fixes are applied to the latest `main` branch. Older commits are not supported.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private vulnerability reporting:

1. Open the repository's **Security** tab.
2. Select **Report a vulnerability**.
3. Include the affected version/commit, a description, reproduction steps, and the impact.

If private reporting is unavailable, open an issue that only says you need a private
security contact, without technical details.

## Scope

In scope:

- The web app, Express API and FastAPI analyzer in this repository.
- The Docker Compose setup and Dockerfiles.
- Google sign-in, the Firestore allowlist, the account-deletion flow and the per-user cloud
  library.
- The optional `services/youtube-extractor` service and its installer/Docker image.
- Authentication, authorization, rate limiting, upload handling, temporary files and
  command execution paths.

Out of scope:

- Vulnerabilities in YouTube, `yt-dlp`, ffmpeg, Essentia, ONNX Runtime or the model files
  themselves. Report those upstream.
- Misconfiguration of a third-party deployment (DNS, OAuth console, firewall, TLS, IAM).
- Denial of service caused by intentionally running the analyzer without limits.

## Deployment expectations

### Local, Docker and VPS

- Do not expose the analyzer or the API directly to the internet. Use the Compose network or a
  reverse proxy.
- Keep `CORS_ORIGIN`, `TRUST_PROXY`, upload limits and rate limits aligned with your topology.
- Run containers as non-root and keep the host and images updated.
- Do not commit `.env` files, tokens or credentials.

### Private online instance on Cloud Run

- The server is intentionally reachable from the internet so the browser can sign in. It is
  not an open instance: keep `AUTH_MODE=google`, configure `ADMIN_EMAILS` and verify the
  allowlist.
- Keep the analyzer private. Only the server service account should have `roles/run.invoker`.
- Restrict the OAuth client's authorised JavaScript origins to the Cloud Run URL or custom
  domain.
- Do not grant broad IAM roles to the runtime service accounts. Terraform creates
  `datastore.user`, `logging.logWriter` and `telemetry.writer` for the server (trace export); the analyzer has no project roles.
- Keep the Terraform state and `terraform.tfvars` private. They can contain the OAuth client
  ID, administrator emails and the extractor token.
- Protect the optional extractor with a long `EXTRACTOR_TOKEN`, bind it to `127.0.0.1` and
  expose it only through Cloudflare Tunnel or Tailscale Funnel. Do not port-forward it or put
  it in a DMZ.
- The Google ID token is stored in `sessionStorage` for the tab session and sent as a Bearer
  token. Keep the CSP strict and avoid adding third-party scripts that could read it.
- Deleting an account removes its cloud library and, for non-admins, its allowlist entry.

## Disclosure

We aim to acknowledge reports within 7 days and to publish a fix or mitigation as soon as
practical. Please give us reasonable time before public disclosure.
