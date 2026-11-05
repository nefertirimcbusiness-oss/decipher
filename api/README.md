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
*   `DELETE /api/entries/:id`: Delete an entry **and its evidence files on disk**
*   `POST /api/savid/chat`: Chat with Savid about a specific entry
*   `GET /api/savid/:entryId`: Get chat history for an entry
*   `POST /api/subscriptions/create`: Start Stripe subscription
*   `GET /api/subscriptions/status`: Get current user subscription status
*   `POST /api/subscriptions/cancel`: Cancel the subscription immediately
*   `DELETE /api/account`: **Delete the calling user's account permanently** (see below)
*   `POST /api/webhooks/stripe`: Stripe webhook handler

## Deletion (what the privacy policy promises)

The privacy policy says a deleted account loses its entries, audio and evidence files,
Savid conversations and edit history. That is what the code now does.

### Deleting one entry — `DELETE /api/entries/:id`

1. Look up the entry, scoped to the caller's own user id (someone else's entry is a 404).
2. `unlink` every file in `evidence_files` for that entry **before** deleting the rows —
   once the rows are gone there is no record of which files to remove. A file that is
   already missing is not an error; any other unlink failure returns 500 and the entry is
   left in place rather than being reported as deleted while its file survives.
3. Delete the `evidence_files`, `edits`, `savid_conversations` and `entries` rows.

### Deleting an account — `DELETE /api/account`

Authenticated with the caller's bearer token; there is no user id in the URL or body, so it
can only ever act on the caller's own account. Deletion is **immediate** — nothing is queued
and no scheduled job is involved. Order matters and is deliberate:

1. **Stripe first.** Each `subscriptions.stripe_subscription_id` is retrieved and cancelled
   (`subscriptions.cancel`), so a deleted user is never billed again. A subscription that is
   already `canceled`/`incomplete_expired`, missing from Stripe (`resource_missing`), or has
   no id is skipped as benign. Any *other* Stripe error returns **502 and deletes nothing** —
   the account stays intact so the user can retry.
2. **Files second.** Every evidence file belonging to the user's entries is unlinked. If one
   cannot be removed the endpoint returns 500 with the offending paths and deletes no rows,
   rather than reporting success with data left on disk. Unlinking is idempotent, so a retry
   is safe.
3. **Rows last**, children before parents: `savid_conversations` → `edits` → `evidence_files`
   → `entries` → `subscriptions` → `users`. The `users` row goes last so a failure partway
   leaves an account that can still authenticate and retry; the response then reports the
   stage that failed instead of claiming success.

`team-db` executes one statement per call (no transactions), so a partial failure cannot be
rolled back — it is reported honestly with the failing stage instead.

Because JWTs are stateless and valid for 7 days, `middleware/auth.js` also rejects *mutating*
requests whose user row no longer exists (401 `Account no longer exists`), so a token left in
a browser after deletion cannot create new rows for a deleted user.

### Deletion by hand (the privacy policy's "email us" path)

```bash
node ops/delete-account.js --email user@example.com          # dry run: shows what would go
node ops/delete-account.js --email user@example.com --confirm # actually deletes
```

### Proving it

```bash
node test/stripe-cancel-branches.mjs   # every Stripe branch, with fake clients (no network)

# end-to-end against a running instance, real disk + real database + real Stripe TEST mode:
BASE_URL=http://127.0.0.1:8000 \
UPLOADS_DIR=/path/to/api/uploads \
STRIPE_TEST_KEY=sk_test_... \
node test/verify-deletion.mjs
```

Both scripts create their own throwaway users and remove them (and their Stripe test-mode
objects) at the end, and fail loudly if the row counts do not return to the baseline.
`UPLOADS_DIR` also overrides where uploads are written and resolved, which is how a test
instance can be kept off the live uploads directory.


## Durability after a machine replacement

The API is started automatically after a machine replacement — no human or agent
action. The autostart hook hangs off the team site server (the one process the
platform reboots from `/home` on every boot), not `/etc`, which is wiped.
See [`ops/README.md`](ops/README.md) for the mechanism, the proof, and the
`verify-durability.sh` script.
