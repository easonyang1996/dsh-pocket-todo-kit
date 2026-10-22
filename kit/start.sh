#!/bin/bash
set -eu
PROFILE="${DSH_PROFILE:-web}"
NODE_EXEC="${DSH_NODE:-$(node -p 'process.execPath')}"
export PATH="$(dirname "$NODE_EXEC"):$PATH"
exec "$NODE_EXEC" "$(command -v dsh)" --profile "$PROFILE" --port "${DSH_PORT:-3080}"
