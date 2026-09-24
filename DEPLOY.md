# Deploying EventPass to your VPS

Takes about 20 minutes. You bring the server and the domain name; everything
else ships with the code.

## 1. What you need

- A VPS running Ubuntu 22.04 or 24.04 (1 GB RAM is plenty for the pilot).
- The domain `events.aicloudconsult.com` pointing at the server.

## 2. Point DNS at the server

In your domain's DNS settings, add:

| Type | Name   | Value            |
| ---- | ------ | ---------------- |
| A    | events | your server's IP |

Wait a few minutes, then confirm it resolves:

```bash
nslookup events.aicloudconsult.com
```

## 3. Prepare the server

SSH in and install Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in afterwards
```

Open the web ports (if a firewall is active):

```bash
sudo ufw allow 80,443/tcp
```

## 4. Copy the project onto the server

From your own machine (this project folder):

```bash
scp -r . your-user@your-server:/opt/event-ticketing
```

or clone it if you keep it in git. Then on the server:

```bash
cd /opt/event-ticketing
```

## 5. Create the production `.env`

```bash
cp .env.example .env   # if you keep one; otherwise create .env by hand
```

`.env` needs these values:

```bash
SESSION_SECRET=<output of: openssl rand -base64 32>
APP_URL=https://events.aicloudconsult.com
APP_NAME=EventPass

# Optional but recommended: your first admin login. If you skip these,
# a random password is generated and printed in the app logs on first
# start — save it and change it right after signing in.
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<redacted>
```

`DATABASE_URL` is already set to the right value inside
`docker-compose.yml` — do not change it.

## 6. Create the data folders, then start

The database and uploaded event images live on the host so they survive
rebuilds. Create both folders before the first start:

```bash
mkdir -p data uploads
docker compose up -d --build
docker compose logs -f app   # watch the first start; Ctrl-C to stop watching
```

The first start applies the database migration and creates the initial
admin account (see the "FIRST-RUN ADMIN ACCOUNT CREATED" banner in the
logs if you skipped `ADMIN_EMAIL`/`ADMIN_PASSWORD`). Caddy fetches the
HTTPS certificate automatically the first time the domain is visited
(this needs step 2 to be done).

## 7. First login (do this immediately)

Open `https://events.aicloudconsult.com/login` and sign in with the
`ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env`. If you skipped those,
copy the generated password from the app logs:

```bash
docker compose logs app | grep -A3 "FIRST-RUN ADMIN"
```

Then click **Password** in the top bar and change it. If you set
`ADMIN_PASSWORD` in `.env`, consider removing that line from `.env` now
that the password is stored as a hash in the database.

## 8. Run your first event

1. **Organizer → New event** — fill in details and how guests pay you
   (e-Transfer email, Zelle handle, cash note).
2. Open the event → **Manage** — add ticket types (price, seats, meal
   included?) and meal options.
3. **Publish** — the public ticket link appears (share it with guests).
4. Guests order at the link and pay you manually. Their orders land in
   **Orders** as *pending*.
5. When money arrives, click **Confirm payment** — their QR tickets are
   issued instantly and appear on their order page.
6. At the door, sign in as door staff and open **Door** — scan QR codes
   with the phone camera, search by name, sell walk-ins for cash, and see
   live meal counts for the kitchen.
7. **Reports** shows revenue by ticket type, by seller, and check-in totals.

Add helpers under **Team**: sellers confirm payments, door staff check
guests in.

## 9. Backups

The whole database is one file: `./data/app.db` on the server. Back it up
regularly:

```bash
cp /opt/event-ticketing/data/app.db ~/event-backup-$(date +%F).db
```

## 10. Updating later

```bash
cd /opt/event-ticketing
# copy in the new code, then:
docker compose up -d --build
```

Migrations run automatically on start; the database file is untouched.

## Troubleshooting

- **Site doesn't load / certificate error** — DNS must resolve to the
  server *before* first start. Check `nslookup`, then
  `docker compose restart caddy` and read `docker compose logs caddy`.
- **App container restarts** — `docker compose logs app` shows why. The
  most common cause is a missing `SESSION_SECRET` in `.env`.
- **Camera won't scan at the door** — browsers only allow the camera on
  HTTPS (or localhost). Make sure you're on the `https://` URL.
- **Forgot the admin password** — on the server:
  `docker compose exec app node -e "…"` is fiddly; instead stop the app,
  copy `data/app.db` aside, and ask your developer to reset it.
