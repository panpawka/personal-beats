#!/usr/bin/env bash
# Usage: bash scripts/env-push.sh <environment>
# Example: bash scripts/env-push.sh development
# Pushes .env.server → <env>-server and .env.client → <env>-client

set -euo pipefail

ENV="${1:-development}"
SHELVE_CFG="shelve.json"
ORIG_ENV_FILE=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$SHELVE_CFG','utf8')).envFileName || '.env')")

restore() {
  node -e "
    const fs = require('fs');
    const c = JSON.parse(fs.readFileSync('$SHELVE_CFG', 'utf8'));
    c.envFileName = '$ORIG_ENV_FILE';
    fs.writeFileSync('$SHELVE_CFG', JSON.stringify(c, null, 2));
  "
}
trap restore EXIT

echo "» Pushing .env.server → $ENV-server"
node -e "const fs=require('fs'),c=JSON.parse(fs.readFileSync('$SHELVE_CFG','utf8'));c.envFileName='.env.server';fs.writeFileSync('$SHELVE_CFG',JSON.stringify(c,null,2))"
shelve push --env "$ENV-server"

echo "» Pushing .env.client → $ENV-client"
node -e "const fs=require('fs'),c=JSON.parse(fs.readFileSync('$SHELVE_CFG','utf8'));c.envFileName='.env.client';fs.writeFileSync('$SHELVE_CFG',JSON.stringify(c,null,2))"
shelve push --env "$ENV-client"

echo "✓ Done ($ENV)"
