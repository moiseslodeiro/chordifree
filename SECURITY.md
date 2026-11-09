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
- Authentication, authorization, rate limiting, upload handling, temporary files and
  command execution paths.

Out of scope:

- Vulnerabilities in YouTube, `yt-dlp`, ffmpeg, Essentia, ONNX Runtime or the model files
  themselves. Report those upstream.
- Misconfiguration of a third-party deployment (reverse proxy, cloud firewall, TLS, IAM).
- Denial of service caused by intentionally running the analyzer without limits.

## Deployment expectations

- Do not expose the analyzer or the API directly to the internet. Use the provided Compose
  network or a reverse proxy.
- Keep `CORS_ORIGIN`, `TRUST_PROXY`, upload limits and rate limits aligned with your topology.
- Run containers as non-root and keep the host and images updated.
- Do not commit `.env` files, tokens or credentials.

## Disclosure

We aim to acknowledge reports within 7 days and to publish a fix or mitigation as soon as
practical. Please give us reasonable time before public disclosure.
