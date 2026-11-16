#!/usr/bin/env bash
# Build both container images with Cloud Build and deploy them through Terraform.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/deploy/gcp"

for command in gcloud terraform; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing $command. Install it and authenticate with gcloud before deploying." >&2
    exit 1
  fi
done

if [[ ! -f terraform.tfvars ]]; then
  echo "Copy terraform.tfvars.example to terraform.tfvars and fill in the values." >&2
  exit 1
fi

TAG="${TAG:-$(git -C "$ROOT" rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)}"

terraform init -input=false

# `terraform output` only persists outputs that depend on the targeted resource.
# Read the variable directly so the first partial apply can still bootstrap the
# image repository.
PROJECT_ID="$(terraform console -no-color <<<'var.project_id' | tr -d '"')"
if [[ -z "$PROJECT_ID" ]]; then
  echo "Could not read project_id from terraform.tfvars." >&2
  exit 1
fi

# The repository has to exist before Cloud Build can push to it.
terraform apply -input=false -auto-approve \
  -target=google_artifact_registry_repository.images

REGISTRY="$(terraform output -raw artifact_registry)"

echo "Building server image in $REGISTRY/server:$TAG"
gcloud builds submit "$ROOT" \
  --project "$PROJECT_ID" \
  --tag "$REGISTRY/server:$TAG" \
  --file apps/server/Dockerfile \
  --timeout 45m

echo "Building analyzer image in $REGISTRY/analyzer:$TAG"
gcloud builds submit "$ROOT/services/analyzer" \
  --project "$PROJECT_ID" \
  --tag "$REGISTRY/analyzer:$TAG" \
  --file Dockerfile \
  --timeout 45m

terraform apply -input=false -auto-approve \
  -var "server_image=$REGISTRY/server:$TAG" \
  -var "analyzer_image=$REGISTRY/analyzer:$TAG"

echo
echo "Chordifree is deployed at: $(terraform output -raw service_url)"
echo "Add that URL to the OAuth client's authorized JavaScript origins before signing in."
