# Decipher API

Backend API for the Decipher app.

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Initialize the database:
    ```bash
    node init-db.js
    ```

3.  Configure environment variables in `.env`:
    *   `PORT`: Server port (default 8000)
    *   `JWT_SECRET`: Secret for JWT tokens
    *   `STRIPE_SECRET_KEY`: Your Stripe secret key
    *   `STRIPE_PRICE_ID`: Stripe price ID for the subscription
    *   `STRIPE_COUPON_ID`: Stripe coupon ID for the 50% discount
    *   `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
    *   `OPENAI_API_KEY`: API key for Savid AI
    *   `FRONTEND_URL`: URL of the frontend for Stripe redirects

4.  Set up Stripe (optional script):
    ```bash
    node setup-stripe.js
    ```

5.  Start the server:
    ```bash
    npm start
    ```

## Running the API on this box (durable)

The backend on this machine runs from `/home/team/shared/decipher-api` on port 8000 and is
served to the outside world through the `-dev.cto.site` and `.cto.site` hosts at `/api/*`.
**Do not start it with a bare `nohup node index.js`** — use `supervise.sh`, which refuses to
start a second copy and records everything it does.

There is no systemd and no pm2 on this box, so `supervise.sh` is the process manager.

```bash
cd /home/team/shared/decipher-api

./supervise.sh status      # is it up? which pid is listening? last log lines
./supervise.sh start       # start it — a no-op if something already listens on :8000
./supervise.sh restart     # stop, then start
./supervise.sh stop        # stop it
./supervise.sh ensure-watchdog   # run the restart-on-death loop in the background
```

### Is it up? (three checks, cheapest first)

```bash
curl -s http://localhost:8000/api/health                 # {"status":"ok"}
curl -s https://eb044699c4cc4dada8cc7727a5002ea2-dev.cto.site/api/health
curl -s https://eb044699c4cc4dada8cc7727a5002ea2.cto.site/api/health
./supervise.sh status
```

### Logs

*   `output.log` — the server's own stdout/stderr (morgan request lines, webhook errors,
    Stripe errors). Appended to, never truncated.
*   `supervisor.log` — timestamped start/stop/restart/watchdog events.

```bash
tail -n 50 /home/team/shared/decipher-api/output.log
tail -n 50 /home/team/shared/decipher-api/supervisor.log
```

### Coming back after a machine replacement

A replaced machine boots with nothing running. One command restores everything:

```bash
/home/team/shared/decipher-api/supervise.sh ensure-watchdog
```

The watchdog checks port 8000 every 15 s and restarts the API if it is down, so a crash is
recovered within 15 s without anyone watching.

To make that automatic, run once (needs root, writes `/etc/profile.d/zz-decipher-api.sh`):

```bash
/home/team/shared/decipher-api/supervise.sh install-autostart
```

After that, every login shell — the owner's terminal and every agent session — calls
`ensure-watchdog`, which starts the watchdog only if it is not already running. The API is
therefore back within seconds of the first shell opening on a fresh machine. If `/etc` is
wiped by a machine replacement, re-run `install-autostart`.

### Environment the supervisor needs

The server loads `./.env` itself (dotenv), so Stripe, JWT, frontend and Savid settings survive
a restart without any shell setup. The `TEAM_DB_*` variables are only exported by the shell
(`/etc/profile.d/team-env.sh`); `supervise.sh` sources that file (and `cto-env-vars.sh`) when
they are missing, so the `team-db` CLI the database layer shells out to keeps working.

## API Endpoints

*   `GET /api/health`: Health probe
*   `POST /api/auth/signup`: User registration
*   `POST /api/auth/login`: User login
*   `GET /api/entries`: Get all entries for the authenticated user
*   `POST /api/entries`: Create a new entry (supports multi-part/form-data for evidence)
*   `GET /api/entries/:id`: Get a specific entry with evidence and history
*   `PUT /api/entries/:id`: Update an entry (requires `reason`)
*   `DELETE /api/entries/:id`: Delete an entry
*   `POST /api/savid/chat`: Chat with Savid about a specific entry
*   `GET /api/savid/:entryId`: Get chat history for an entry
*   `POST /api/subscriptions/create`: Start Stripe subscription
*   `GET /api/subscriptions/status`: Get current user subscription status
*   `POST /api/subscriptions/cancel`: Cancel the subscription immediately
*   `POST /api/webhooks/stripe`: Stripe webhook handler
