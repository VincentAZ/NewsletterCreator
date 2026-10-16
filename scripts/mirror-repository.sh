#!/usr/bin/env bash
set -euo pipefail

: "${MIRROR_REPOSITORY_URL:?Set MIRROR_REPOSITORY_URL to the authorized destination}"

# actions/checkout only creates a local branch for the triggering ref. Mirror
# explicit source namespaces so a feature push cannot delete the target main.
# PR refs, remote-tracking refs and local working branches are never published.
git fetch --no-tags --prune "${SOURCE_REPOSITORY_URL:-origin}" \
  '+refs/heads/*:refs/mirror-source/heads/*' \
  '+refs/tags/*:refs/mirror-source/tags/*'
git push --prune "$MIRROR_REPOSITORY_URL" \
  '+refs/mirror-source/heads/*:refs/heads/*' \
  '+refs/mirror-source/tags/*:refs/tags/*'
