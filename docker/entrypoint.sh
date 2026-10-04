#!/bin/sh
set -e

# Apply pending database migrations, then start the app.
# Invoke the CLI directly so the runtime image does not need npm's .bin shims.
node ./node_modules/prisma/build/index.js migrate deploy

# Seed the initial admin account on a brand-new database only.
node prisma/seed.js

exec node server.js
