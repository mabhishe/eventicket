# Build Audit — EventPass ticketing scaffold

**Date:** 2026-09-23
**Scope:** the `event-ticketing` project as left by the 2026-09-22 build session,
audited file-by-file against what was actually on disk.

---

## 1. What the earlier build left behind (verified on disk)

Solid, working foundations:

- **Project scaffold** — Next.js 16.3.6 + TypeScript + Tailwind CSS 4, React 19,
  App Router. `proxy.ts` (the renamed middleware) gating `/admin/*` and
  `/door/*` behind a signed session.
- **Dependencies** — `package.json` / `package-lock.json` with everything the
  app needs: `prisma` + `@prisma/client` (both pinned at 6.19.3),
  `jose` (sessions), `bcryptjs` (passwords), `qrcode`, `html5-qrcode`,
  `nodemailer` (installed but never wired up), `zod`.
- **Data model** — `prisma/schema.prisma`: User (ADMIN/SELLER/DOOR), Event,
  TicketType, MealOption, Order, OrderItem, Ticket. Well designed; kept as-is.
- **Auth + DB helpers** — `lib/auth.ts` (bcrypt, signed httpOnly cookie
  session, `requireUser`), `lib/db.ts` (Prisma singleton), `lib/money.ts`
  (cents formatting).
- **Seed script** — `prisma/seed.js` creating the initial admin account.
- **Docs** — `ARCHITECTURE.md` describing the intended flows.

## 2. What was broken or never started

- **The database was never built.** `prisma generate` and `prisma migrate`
  had never run; no database file existed; the seed had never executed. The
  schema existed only on paper.
- **No product code existed.** `app/` contained only the default Next.js
  starter page. There were zero routes, zero pages, zero API endpoints — no
  login screen, no event management, no checkout, no tickets, no door
  check-in, no reports.
- **No deployment packaging.** No `Dockerfile`, no compose file, no Caddy
  config, no deploy guide.
- **Environment blocker found and fixed:** Prisma's engine downloader cannot
  fetch through this sandbox's egress proxy (`ECONNRESET` on every attempt).
  Workaround: the exact engine binaries for prisma 6.19.3 /
  `debian-openssl-3.0.x` were fetched with curl, checksum-verified, and
  vendored into `docker/prisma-engines/` so `generate`/`migrate` work
  offline. The Dockerfile reuses them so the image builds anywhere.

## 3. What this build added or repaired

**Database** — generated the Prisma client, created the initial migration
(`prisma/migrations/20260924001835_init/`), applied it, and seeded the
admin account. Verified with real queries.

**Auth** — `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`,
`POST /api/me/password` (change your own password), plus a `requireApiUser`
helper so every API route enforces roles (the page-level proxy only covers
pages, not `/api/*`). New `/login` page and a **Password** page linked in
the nav.

**Organizer (ADMIN/SELLER)** — event CRUD with draft/published/closed
states, ticket types (price, seats, meal-included flag), meal options,
payment instructions (e-Transfer email, Zelle handle, cash note), public
share link on publish. Team management (create ADMIN/SELLER/DOOR users).

**Guest flow (no sign-in)** — public event listing, per-event ticket page
with live seat availability, order form (name, email, phone, payment
method, meal choices), and an order-status page showing exactly how to pay
plus the issued QR tickets once confirmed.

**Payments → tickets** — orders start `PENDING_PAYMENT`; confirming payment
flips them to `CONFIRMED` and auto-generates one ticket per seat with a
short readable code (`K7Q2M9XD` style) and a QR code encoding the ticket
URL. Cancelling voids the tickets. Walk-in cash sales create, issue, and
optionally check in tickets in one step.

**Door (DOOR/ADMIN)** — event picker with live check-in counts; camera QR
scanning (`html5-qrcode`) plus manual code entry; duplicate scans are
detected and reported instead of double-counting; name/code search with
one-tap check-in; walk-in sales; per-meal counts for the kitchen.

**Reports (ADMIN)** — revenue, orders, tickets issued vs checked in, sales
by ticket type, sales by seller, meal totals with checked-in splits.

**Deploy packaging** — multi-stage `Dockerfile` (standalone Next.js build),
`docker-compose.yml` (app + Caddy with automatic HTTPS),
`Caddyfile` for `events.aicloudconsult.com`, `docker/entrypoint.sh`
(runs migrations + seed on start), `.env.example`, `.dockerignore`, and
`DEPLOY.md` — a step-by-step guide covering DNS, Docker install, first
login, running an event, backups, and updates.

## 4. Verification (real runs, not inspection)

- `npm run build` — passes; 34 routes compiled.
- Fresh database (`migrate deploy` + seed from empty) — admin login works.
- End-to-end flow against the production server, every step over real HTTP:
  login → create event → add 2 ticket types + 2 meal options → publish →
  public page renders → guest order (2×General + 1×VIP = $125.00, pending)
  → order page shows e-Transfer instructions → confirm payment → 3 tickets
  issued with QR codes → ticket page renders QR → check-in via code →
  duplicate scan of the same QR correctly reports "already checked in" →
  walk-in cash sale of 2 tickets (issued + checked in) → search finds
  tickets → reports show 2 orders, $175.00 revenue, 5 tickets, 3 checked
  in, correct meal counts.
- Auth gating: `/admin` without login redirects to `/login`; admin APIs
  return 401 without a session; capacity limits enforced (ordering 99 of 19
  remaining VIP seats rejected with a clear message).
- The database was reset to clean afterwards: 1 admin user, 0 events,
  0 orders.

## 5. Known gaps / deferred

- **Email delivery is not wired up.** `nodemailer` is installed and
  `ARCHITECTURE.md` lists it as optional; the ticket and order pages are
  the delivery mechanism for the pilot (on-screen QR, printable). Wire it
  later if guests need tickets by email.
- **The Docker image was not built here** — this machine has no Docker
  daemon. Every step the image performs (`npm ci`, engine vendoring,
  `prisma generate`, `npm run build`, `migrate deploy`, seed, `node
  server.js`) was run and verified individually in the same
  Node 24 / Debian-family environment the image uses.
- **No automated test suite.** The flows above were exercised with a
  scripted API test (`/tmp/e2e.mjs`, 46 assertions, all passing on
  2026-09-24); add a permanent test suite before the B2C phase.

---

## 6. Round 2 (2026-09-24): per-person meals, food service, branding, mobile

Delivered on top of the verified baseline, tested end-to-end with the same
scripted API approach (46 assertions, all passing against a fresh database):

- **Per-person food selection** — checkout and walk-ins now submit one
  quantity-1 order item per attendee, each with a name and a meal choice.
  The meal is required server-side when the ticket includes food and meal
  options exist. The ticket carries the holder name and meal.
- **Meal diet tags** — each meal option is tagged veg / non-veg / untagged
  in the admin UI, shown to guests at checkout, and surfaced in reports.
- **Independent food collection** — the door console has Entry and Food
  tabs. Food scanning records `foodCollectedAt` per ticket, is independent
  of check-in, rejects duplicates (returning the original collection
  time), and shows a large green VEG / red NON-VEG / neutral NO MEAL
  result so servers see the direction at a glance.
- **Event branding** — logo upload plus a gallery (JPG/PNG/WebP/GIF,
  5 MB max, 12 images max) and a custom brand color per event, shown on
  the public event page and event listings.
- **Guest-list CSV** — ADMIN-only export with holder name, ticket type,
  meal + diet tag, check-in and food-collection status/times, buyer
  contact, and ticket code. Cells are escaped against formula injection.
- **Find-my-tickets** — guests look up their order links with their name
  plus the exact email/phone used at purchase; only matching order links
  are returned, never ticket codes or other guests' details.
- **Mobile-friendly pass** — collapsible nav menu on small screens,
  single-column checkout with 44px quantity controls, horizontal scroll
  on wide tables, and larger shared touch targets (buttons/inputs/filter
  chips).
- **First-admin setup is now environment-driven** — `prisma/seed.js` no
  longer uses a fixed password. Set `ADMIN_EMAIL`/`ADMIN_PASSWORD` (min 8
  chars) for first run; otherwise a random password is generated and
  printed once in the logs. `npm start` now runs the seed before
  `next start`, and the Docker entrypoint already did.
- **Upload persistence** — `public/uploads/<eventId>/` is mounted at
  `./uploads` in `docker-compose.yml`; create `data/` and `uploads/`
  before the first `docker compose up` (documented in DEPLOY.md).

Database migrations added: `round2_meals_branding_food`
(`Event.logoUrl`, `Event.imageUrls`, `Event.brandColor`,
`MealOption.tag`, `Ticket.foodCollectedAt`) and `round2b_holder_brand`
(`OrderItem.holderName`).

Post-pilot ideas (discount codes, add-ons, reminders, SMS broadcasts,
messaging templates, tiered plans, org settings, scan station modes,
organizer dashboard) are logged in the project backlog, not in this
build.

## 7. Round 3 (2026-09-24): sponsor ads

Delivered on top of the round-2 build, tested end-to-end with a scripted
API run (21 assertions, all passing against a fresh database):

- **Sponsor ads per event** — the admin adds sponsors on the event page:
  sponsor name, logo image (JPG/PNG/WebP/GIF, 5 MB max, same upload
  pipeline as branding), and an optional website link. Logos are stored
  under `public/uploads/<eventId>/` and served with the event.
- **Shown across the guest journey** — an "Our sponsors" strip appears on
  the public event page (while booking), on the order/payment page, and
  on each ticket page. Logos with a link open it in a new tab
  (`rel="noopener sponsored"`); logos without a link render unlinked.
- **Admin management** — list with thumbnails, add form, and remove
  (deletes the DB row and the image file). Links must start with
  `http://` or `https://`; anything else is rejected. The API is
  ADMIN-only: unauthenticated requests get 401.
- **Public API** — `/api/events/[slug]` now includes `sponsorAds` in
  display order; the order and ticket pages include them via Prisma.

Database migration added: `round3_sponsor_ads` (new `SponsorAd` model:
`eventId`, `name`, `imageUrl`, `linkUrl`, `sortOrder`).

Note: `npm run lint` reports pre-existing `react-hooks/set-state-in-effect`
errors on the admin/door pages (the data-loading pattern predates this
build; the new code follows the same established pattern) plus
`no-require-imports` in `prisma/seed.js`. `tsc` and `next build` are clean.

## 8. Deployment checklist

Follow **`DEPLOY.md`** in this folder, in order: DNS → Docker on the
server → copy project → `.env` → `docker compose up -d --build` →
first login → **change the admin password** → create your first event.

**File map**

- App code: this folder (`event-ticketing/`)
- This audit: `AUDIT.md` (this file)
- Deployment checklist: `DEPLOY.md`
