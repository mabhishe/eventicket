# EventPass

EventPass is a self-hosted event ticketing app: create events, sell tickets
online, confirm payments manually (e-Transfer / Zelle / cash), issue QR
tickets, and run the door with phone-based check-in scanning — including a
separate food-collection scan for catered events. It also supports event
branding, per-event sponsor ads, and a mobile-friendly experience throughout.

## Features

### Events & tickets
- Create events with title, date, venue, description, capacity, and ticket
  types (name, price, quantity).
- Draft / published / archived event lifecycle.
- Public event pages with a ticket selector and one-page checkout.
- Per-attendee details at checkout: name and meal choice per ticket.

### Payments (manual confirmation)
- Guests pay by e-Transfer, Zelle, or cash and submit their payment
  reference; an admin confirms each order from the admin panel.
- Orders track status: pending → confirmed / cancelled.
- Capacity is enforced at checkout and for walk-ins.

### Tickets & door check-in
- Each confirmed ticket gets a unique code and a QR code, viewable on its
  own ticket page.
- Door console (`/door/[eventId]`) scans QR codes with the phone camera
  (or manual code entry), shows a big PASS/FAIL result, and rejects
  duplicates with the original check-in time.
- Walk-in sales: sell and issue tickets at the door in one step.

### Food service
- Meal options per event, tagged veg / non-veg / untagged, chosen
  per attendee at checkout and walk-in.
- Independent food-collection scanning: records `foodCollectedAt` per
  ticket, separate from entry check-in, with duplicate handling.
- Big green **VEG** / red **NON-VEG** / neutral **NO MEAL** result so
  servers see the direction at a glance.

### Branding & sponsor ads
- Per-event logo, photo gallery (up to 12 images), and brand color, shown
  on the public event page and listings.
- **Sponsor ads**: admin uploads sponsor logos with optional website
  links per event. An "Our sponsors" strip appears on the event page,
  the order/payment page, and each ticket page; linked logos open in a
  new tab.
- **Program / schedule**: admin adds timed agenda entries (e.g. "6:00 PM —
  Doors open"); shown as a Program section on the public event page.
- Uploads accept JPG/PNG/WebP/GIF (5 MB max) and live under
  `public/uploads/<eventId>/`; in production they are served by the
  built-in `/uploads/[...path]` route so files added after the build
  work too.

### Admin tools
- Dashboard with events, orders, ticket types, meal options, media,
  users, and reports.
- Guest-list CSV export (holder name, ticket type, meal + diet tag,
  check-in and food-collection status, buyer contact, ticket code;
  formula-injection safe).
- Door search by name, order management (confirm/cancel), user roles
  (ADMIN / STAFF), and password change from the top bar.

### Guest tools
- **Find my tickets**: guests look up their order links with their name
  plus the exact email/phone used at purchase.
- Mobile-first layout: collapsible nav menu, 44px touch targets,
  single-column checkout, horizontal scroll on wide tables.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind CSS 4**
- **Prisma 6** with **SQLite** (file-based, zero external DB to run)
- **Docker** + **Caddy** for production (reverse proxy with automatic HTTPS)
- QR codes via `qrcode`

## Quick start (local)

Needs Node.js 24 and a terminal.

```bash
npm ci
```

Create a `.env` file in the project folder:

```bash
DATABASE_URL="file:./prisma/dev.db"
SESSION_SECRET="<run: openssl rand -base64 32>"
APP_URL="http://localhost:3000"
APP_NAME="EventPass"
```

Optional — set your first admin login up front (min 8 chars):

```bash
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=choose-a-strong-password
```

If you skip those, the first `npm start` generates a random admin password
and prints it once — look for `FIRST-RUN ADMIN ACCOUNT CREATED` in the
terminal, then change it right after signing in (top bar → Password).

```bash
npx prisma migrate deploy
npm run build
npm start
```

Open http://localhost:3000, sign in at `/login`, create your first event.

> Full laptop walkthrough: [`LOCAL.md`](LOCAL.md).

## Production deployment (Docker)

```bash
mkdir -p data uploads
# edit .env for production (APP_URL=https://your-domain)
docker compose up -d --build
```

The entrypoint applies migrations, seeds the first admin if the database is
empty, and starts the app. Caddy terminates HTTPS automatically.

- SQLite lives on the `./data` volume; uploads on `./uploads`
  (`/app/public/uploads` in the container), so both survive rebuilds.
- Point your domain at the server first (DNS A record).

> Step-by-step checklist: [`DEPLOY.md`](DEPLOY.md).

## Key pages

| Page | Who | What |
|---|---|---|
| `/` | Guest | Event listings |
| `/e/[slug]` | Guest | Event details + booking |
| `/order/[id]` | Guest | Order status + payment instructions |
| `/t/[code]` | Guest | Ticket with QR code |
| `/find-tickets` | Guest | Look up orders by name + email/phone |
| `/login` | Admin/Staff | Sign in |
| `/admin` | Admin | Events, orders, reports, users |
| `/admin/events/[id]` | Admin | Event setup, media, sponsors |
| `/door/[eventId]` | Staff | Check-in + food scanning console |

## API overview

- `POST /api/orders` — create an order (capacity-checked)
- `GET /api/orders/[id]` — order status (guest)
- `GET /api/tickets/[code]` — ticket details + QR payload
- `POST /api/checkin` — entry scan (idempotent, duplicate-safe)
- `POST /api/food` — food-collection scan (idempotent)
- `POST /api/find-tickets` — guest order lookup
- `GET /api/events/[slug]` — public event data incl. sponsor ads
- `/api/admin/*` — ADMIN-only: events, ticket types, meal options,
  media, sponsors, orders, walk-ins, reports, users

## Project structure

```
app/                # Pages + API routes (App Router)
  admin/            # Admin console
  door/             # Door scanning console
  e/[slug]/         # Public event page
  order/[id]/       # Order / payment page
  t/[code]/         # Ticket page
  api/              # JSON APIs
components/         # Shared UI (incl. sponsors-strip)
lib/                # Auth, Prisma client, helpers
prisma/             # Schema, migrations, seed
docker/             # Entrypoint, vendored Prisma engines
docker-compose.yml  # App + Caddy
Caddyfile           # Reverse proxy config
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite path (`file:./prisma/dev.db` local; `/app/data/prod.db` in Docker) |
| `SESSION_SECRET` | Yes | Signs session cookies (32+ random chars) |
| `APP_URL` | Yes | Public base URL (used in links) |
| `APP_NAME` | No | Brand name (default `EventPass`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No | First-run admin; both or neither (min 8 chars). Otherwise a random password is generated once. |

## Docs

- [`AUDIT.md`](AUDIT.md) — what was built and verified, round by round
- [`DEPLOY.md`](DEPLOY.md) — production deployment checklist
- [`LOCAL.md`](LOCAL.md) — running it on your laptop

## Notes

- Uploaded images are served from `public/uploads/<eventId>/`; in Docker
  this is a mounted volume (`./uploads`).
- `npm run lint` currently reports pre-existing `react-hooks`
  exhaustive-deps style warnings on the admin/door pages; `tsc` and
  `next build` are clean.
