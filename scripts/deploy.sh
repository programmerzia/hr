#!/usr/bin/env bash
# Deploy on the server. Run as root from the repo dir: bash scripts/deploy.sh
# First run: copy .env.example to .env, set APP_ENV=production, APP_DEBUG=false, APP_URL, DB_*, SEED_ADMIN_*; php artisan key:generate.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
composer install --no-dev --optimize-autoloader --no-interaction
npx -y pnpm@12 install --frozen-lockfile
# Build into a side folder and swap it in, so the live site never runs without a manifest.
# Old hashed assets are kept for a week so open tabs can still lazy-load the chunks they know.
npx -y pnpm@12 exec tsc -b
rm -rf public/build-next
npx -y pnpm@12 exec vite build --outDir public/build-next --emptyOutDir
if [ -d public/build/assets ]; then cp -rnp public/build/assets/. public/build-next/assets/; fi
rm -rf public/build-old
if [ -d public/build ]; then mv public/build public/build-old; fi
mv public/build-next public/build
rm -rf public/build-old
find public/build/assets -type f -mtime +7 -delete
php artisan migrate --force
php artisan access:sync
php artisan payroll:backfill-snapshots
php artisan storage:link >/dev/null 2>&1 || true
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
chown -R www-data:www-data storage bootstrap/cache public/build
echo "deployed $(git rev-parse --short HEAD)"
