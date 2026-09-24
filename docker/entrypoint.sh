#!/bin/sh
set -e

# Apply pending database migrations, then start the app.
npx prisma migrate deploy

# Seed the initial admin account on a brand-new database only.
node prisma/seed.js

exec node server.js
