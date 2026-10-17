#!/usr/bin/env bash
set -euo pipefail
: "${NEWSLETTER_NETWORK_TRACE:?Set the output path for the network trace}"
: "${NEWSLETTER_ELECTRON_BINARY:?Set the Electron executable}"
exec strace -ff -s 128 -e trace=network -o "$NEWSLETTER_NETWORK_TRACE" "$NEWSLETTER_ELECTRON_BINARY" "$@"
