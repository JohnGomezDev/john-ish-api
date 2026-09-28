#!/bin/sh
set -eu

echo "🛠️  Running migrations..."

node node_modules/typeorm/cli.js migration:run -d dist/database/datasource.js

if [ "${RUN_SEEDERS}" = "true" ]; then
  echo "🌱  Running seeders..."

  node node_modules/typeorm-extension/bin/cli.mjs seed:run -d dist/database/datasource.js
fi

echo "🚀  Starting application..."

exec node dist/main.js
