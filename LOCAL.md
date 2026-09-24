# Running EventPass on your own laptop

Needs: Node.js 24 (LTS) — install from nodejs.org — and a terminal.

## 1. Get the code

Unzip the project file and open a terminal inside the folder.

## 2. Install dependencies

```bash
npm ci
```

## 3. Create your `.env` file

In the project folder, create a file named `.env` with:

```bash
DATABASE_URL="file:./prisma/dev.db"
SESSION_SECRET=<paste a random string here>
APP_URL="http://localhost:3000"
APP_NAME="EventPass"
```

For the secret, run `openssl rand -base64 32` and paste the output.

You can also set your first admin login here (optional):

```bash
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<redacted>
```

If you skip those, `npm start` generates a random admin password and
prints it once — look for "FIRST-RUN ADMIN ACCOUNT CREATED" in the
terminal, then change it right after signing in.

## 4. Build the database and start

```bash
npx prisma migrate deploy
npm run build
npm start
```

Open http://localhost:3000 in your browser.

## 5. Sign in

Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env`.
If you skipped those, the generated password was printed in the terminal
when you ran `npm start` — search for "FIRST-RUN ADMIN ACCOUNT CREATED".

Change it right away: click **Password** in the top bar.

## Try a full event

1. **Organizer → New event** — create one and open **Manage**.
2. Add a ticket type (e.g. General, $25, 100 seats) and a meal option.
3. **Publish** — copy the public ticket link.
4. Open the link in a private/incognito window, buy tickets, and note the
   payment instructions on the order page.
5. Back as admin: **Orders → Confirm payment** — the QR tickets are issued.
6. **Door** — search the guest's name or type the ticket code to check in.
7. **Reports** — see revenue and meal totals.

Your laptop database is the file `prisma/dev.db`. Delete it and re-run
`npx prisma migrate deploy` any time you want a fresh start.
