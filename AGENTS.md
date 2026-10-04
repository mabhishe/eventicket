<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Use Node.js 24 (`node -v`). Install dependencies with `npm ci` (lockfile: `package-lock.json`). `npx prisma generate` and `npx prisma migrate deploy` prepare SQLite. `DATABASE_URL="file:./prisma/dev.db"` is resolved relative to `prisma/schema.prisma`, so the file is `prisma/prisma/dev.db`.
- If `.env` is missing, create it with `DATABASE_URL="file:./prisma/dev.db"`, a random `SESSION_SECRET`, `APP_URL="http://localhost:3000"`, `APP_NAME="EventPass"`, `ADMIN_EMAIL="admin@eventpass.local"`, and `ADMIN_PASSWORD="eventpass-dev"`. Then run `node prisma/seed.js`. Publishing events requires `emailVerified` on that admin; set it for this local account after seeding. Do not commit `.env` or `prisma/*.db`.
- The dev server is `npm run dev -- --hostname 0.0.0.0 --port 3000` (already running on port 3000 in Cloud Agents). Sign in at `/login` with the admin email and password from `.env`.
- `npx tsc --noEmit` and `npm run build` are the clean checks. `npm run lint` currently exits non-zero because of existing `react-hooks` and other eslint findings. There is no automated test suite.
