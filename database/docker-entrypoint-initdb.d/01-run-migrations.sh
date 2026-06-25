#!/bin/sh
set -e

echo "Running database migrations..."

for file in /migrations/*.sql; do
  if [ -f "$file" ]; then
    echo "Applying $(basename "$file")..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$file"
  fi
done

echo "Database migrations complete."
