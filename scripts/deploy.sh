#!/usr/bin/env bash
# Deploy on the server. Run as root from the repo dir: bash scripts/deploy.sh
# First run: copy .env.example to .env, set APP_ENV=production, APP_DEBUG=false, APP_URL, DB_*, SEED_ADMIN_*; php artisan key:generate.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
composer install --no-dev --optimize-autoloader --no-interaction
npx -y pnpm@12 install --frozen-lockfile
npx -y pnpm@12 build
php artisan migrate --force
php artisan payroll:backfill-snapshots
php artisan storage:link >/dev/null 2>&1 || true
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
chown -R www-data:www-data storage bootstrap/cache public/build
echo "deployed $(git rev-parse --short HEAD)"
