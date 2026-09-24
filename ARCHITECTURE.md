# Event Ticketing App — Architecture

A Tixivent-style event ticketing system: sell tickets, collect payment manually
(Interac e-Transfer, Zelle, cash — no card processor), issue QR tickets,
check guests in at the door, track meals, and report.

Pilot target: user's community event. Then B2C. Hosted at events.aicloudconsult.com.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Prisma ORM — SQLite for the pilot, Postgres-ready (one env/provider switch)
- Auth: credentials (bcrypt) + signed httpOnly cookie session (jose). Roles: ADMIN, SELLER, DOOR
- QR codes: `qrcode` (server-side PNG/data-URL). Ticket code = `nanoid` unique id, verified against DB at check-in
- Door scanning: `html5-qrcode` (device camera in browser)
- Email (ticket delivery): nodemailer, optional SMTP config; always falls back to on-screen ticket + print
- Deploy: Docker multi-stage build + docker-compose + Caddy (automatic HTTPS). See DEPLOY.md

## Domain model

- **User** — id, name, email (unique), passwordHash, role (ADMIN|SELLER|DOOR)
- **Event** — id, slug (unique), title, description, date, venue, currency,
  status (DRAFT|PUBLISHED|CLOSED), payment instructions (etransferEmail, zelleHandle, cashNote), createdById
- **TicketType** — id, eventId, name, description, priceCents, quantityTotal, includesMeal, sortOrder
- **MealOption** — id, eventId, name, sortOrder
- **Order** — id, eventId, buyerName, buyerEmail?, buyerPhone?, status
  (PENDING_PAYMENT|CONFIRMED|CANCELLED), payMethod (ETRANSFER|ZELLE|CASH),
  sellerId?, totalCents, createdAt
- **OrderItem** — id, orderId, ticketTypeId, qty, unitPriceCents, mealOptionId?
- **Ticket** — id, code (unique), orderId, ticketTypeId, holderName?, mealOptionId?,
  status (ISSUED|CHECKED_IN|CANCELLED), checkedInAt?

## Key flows

1. **Create event (ADMIN)** — `/admin/events/new`: details, ticket types, meal options,
   payment instructions → publish → public link `/e/[slug]`
2. **Buy (guest)** — `/e/[slug]`: pick ticket qty (+ meal choice), buyer details →
   Order (PENDING_PAYMENT) → `/order/[id]` shows how to pay (e-Transfer/Zelle/cash)
3. **Confirm (ADMIN/SELLER)** — orders list → mark CONFIRMED when money arrives →
   tickets auto-generated → guest opens `/t/[code]` (QR), emailed if SMTP set
4. **Door (DOOR/ADMIN)** — `/door`: pick event → camera scan QR (html5-qrcode) or
   search name/code → validate → CHECKED_IN. Walk-in: create CASH order + issue +
   check in, one action. Meal counts visible for kitchen.
5. **Reports (ADMIN)** — revenue by ticket type, by seller, sold vs checked-in, meal counts

## Conventions

- Money: integer cents everywhere (`priceCents`). Format with Intl.NumberFormat per event currency.
- Server Components for pages; Server Actions or `/api` routes for mutations — pick one per feature, prefer Server Actions.
- No card processing anywhere by design. Never store full payment credentials.
- Env: `DATABASE_URL`, `SESSION_SECRET` (required), `APP_URL`, `SMTP_*` (optional), `APP_NAME`.

## Out of scope for pilot

Discount codes, SMS messaging, multi-organization, public event discovery/marketplace,
refunds via processor, offline check-in sync. (B2C phase.)
