#!/bin/bash
set -e

echo "==> Running database migrations..."
node scripts/migrate.mjs

echo "==> Post-merge setup complete."
