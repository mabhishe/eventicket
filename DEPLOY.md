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

# A long random string that authorizes the reminder cron (section 10).
# Generate: openssl rand -hex 32
CRON_SECRET=<redacted>

# Public "create account" is off unless this is exactly true.
# Leave it unset for a single community event. Organizers and door
# staff are added from Team. Set true only if strangers should be
# able to open their own organization.
# ALLOW_PUBLIC_SIGNUP=true
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

Backups are automatic: the `backup` sidecar in `docker-compose.yml` takes an
hourly `sqlite3 .backup` snapshot of the live database into `./backups` on
the server (timestamped `app-YYYYMMDDTHHMMSSZ.db`) and deletes backups older
than 7 days. `./backups` is created automatically on first start.

### Restore from backup

1. Stop the app and the backup sidecar so nothing writes while you restore:
   ```bash
   docker compose stop app backup
   ```
2. Copy the backup you want over the live database file:
   ```bash
   cp backups/app-<timestamp>.db data/app.db
   ```
3. Start everything again:
   ```bash
   docker compose start
   ```
4. Open the site and confirm the data looks right (e.g. **Orders** and
   **Reports**).

The manual alternative (no sidecar running) is a plain file copy while the
app is stopped:
```bash
docker compose stop app
cp /opt/event-ticketing/data/app.db ~/event-backup-$(date +%F).db
docker compose start
```

## 10. Reminder cron (scheduled emails + nightly payment nudges)

The messaging center's scheduled event reminders and the 8pm payment-nudge
emails are sent by `GET /api/cron/reminders`, which must be called hourly.
It is protected by `CRON_SECRET` (set in section 5). On the server, add a
cron entry for the deploy user:

```bash
crontab -e
# add this line (paste your actual CRON_SECRET value — cron has no shell env):
0 * * * * curl -s -H "Authorization: Bearer PASTE_CRON_SECRET_HERE" https://eventpass.aicloudconsult.com/api/cron/reminders
```

Send the secret in the `Authorization` header only. A `?secret=` query
string is ignored and would show up in logs and browser history.

Notes:
- Emails only go out once `RESEND_API_KEY` + `EMAIL_FROM` are set (section 5).
  Without them the dispatcher runs but sends nothing.
- WhatsApp reminders only send if the organization configured a custom
  WhatsApp template for that message (Meta requires pre-approved templates).
- The endpoint returns `{ ok, remindersSent, nudgesSent }` JSON so you can
  verify it in the server logs.

## 11. Updating later

The database (`data/app.db`), uploaded images (`uploads/`), backups, and
`.env` live on the server next to the code. A deploy must not delete
them. Do not run `docker compose down -v` or `git clean`.

Manual update, from the server:

```bash
cd /opt/event-ticketing
git fetch origin main
git checkout -f -B main origin/main
docker compose up -d --build
```

`docker compose up -d --build` recreates the app container. The
`./data` and `./uploads` folders are bind mounts, so the files stay.
On startup the app runs `prisma migrate deploy`, which only applies new
migrations. The first-run admin seed does nothing once a user exists.
The site is briefly unavailable while the new container starts. Orders,
guests, and images remain.

### Automatic deploy when `main` changes

GitHub Actions can do that update for you. The workflow is
`.github/workflows/deploy.yml`. It runs on every push to `main`.

Before the first merge, add three repository secrets. GitHub.com →
this repo → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**:

| Name | Value |
| ---- | ----- |
| `SERVER_IP` | The VM's external IP |
| `SERVER_USERNAME` | The Linux user you SSH in as |
| `SSH_PRIVATE_KEY` | The private key from the steps below |

Create a key that can only be used for this deploy. On the VM:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
```

Open `~/.ssh/github_actions`, copy the whole block into the
`SSH_PRIVATE_KEY` secret, save the secret, then remove the private key
from the server so it only lives in GitHub:

```bash
shred -u ~/.ssh/github_actions
```

Do not commit that key, and do not paste it into chat. The public key
stays in `authorized_keys`.

The deploy user needs to run Docker without a password prompt. The
`docker` group from section 3 covers that. If Docker on the VM still
needs `sudo`, allow it with no password for that user (`sudo -n`),
because the action cannot type a password.

What the action does, in order:

1. Writes `backups/predeploy-<timestamp>.db` with `sqlite3 .backup`
   while the current app is still running.
2. Checks out `main`. This does not delete `data/`, `uploads/`,
   `backups/`, or `.env`.
3. Runs `docker compose up -d --build`.

Watch it under the **Actions** tab. After a deploy, confirm an order
you already know is still listed. A bad release can be put back by
stopping the app and copying the matching `backups/predeploy-*.db` onto
`data/app.db` (same steps as section 9). Pre-deploy snapshots are kept
for 30 days.

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
