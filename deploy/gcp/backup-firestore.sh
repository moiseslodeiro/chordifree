#!/usr/bin/env bash
# Export the Firestore database used by Chordifree to a GCS prefix.
# Usage: ./backup-firestore.sh gs://your-bucket/chordifree/2026-11-16
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

DEST="${1:-}"
if [[ -z "$DEST" ]]; then
  echo "Usage: $0 gs://bucket/prefix" >&2
  exit 1
fi

PROJECT_ID="${PROJECT_ID:-$(terraform output -raw project_id)}"
DATABASE="${FIRESTORE_DATABASE:-$(terraform output -raw firestore_database)}"

echo "Exporting Firestore database '$DATABASE' from project '$PROJECT_ID' to $DEST"
gcloud firestore export "$DEST" \
  --project "$PROJECT_ID" \
  --database "$DATABASE"

echo "Export complete."
