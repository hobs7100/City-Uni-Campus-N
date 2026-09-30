#!/bin/bash
set -euo pipefail

if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  changed_migrations=$(git diff --name-only --diff-filter=A HEAD^ HEAD -- db/migrations/)
  migrations=()
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    migrations+=("${path#db/migrations/}")
  done <<< "$changed_migrations"

  if ((${#migrations[@]})); then
    echo "==> Applying migrations added by the merged commit..."
    node scripts/migrate.mjs --only "${migrations[@]}"
  else
    echo "==> No new migrations in the merged commit; skipping database changes."
  fi
else
  echo "==> No parent commit available; skipping database changes."
fi

echo "==> Post-merge setup complete."
