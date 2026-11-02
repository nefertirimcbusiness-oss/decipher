# API durability: surviving a machine replacement

**Answer: yes — after a machine replacement the API comes back by itself, with no
human or agent action.** This directory holds the mechanism and the proof.

## Why the old autostart did not work

`supervise.sh install-autostart` wrote `/etc/profile.d/zz-decipher-api.sh`. That
file does not survive: `/` is an overlay filesystem (`mount` shows
`overlay on / ... upperdir=/mnt/tmp/upper`) and only `/home` is a persistent
volume (`fs0 on /home type virtiofs`). Every machine replacement rebuilds `/etc`
from the image, so the hook disappeared and the API stayed down until someone
noticed — which is exactly what happened on 2026-11-02 and once before.

There is also no OS-level autostart to fall back on: no systemd
(`/run/systemd/system` does not exist), no cron daemon running, no `rc.local`.
PID 1 is `/entrypoint.sh`, which starts the sandbox API and nothing else.

## What does come back on its own

The team site server. The platform's provisioning runs, on every boot:

```
cd /home/team/shared/site && bun install && bun run dev     # + a keep-alive loop
```

`/home` persists, so that boot command is the one durable trigger on this box.
The API autostart therefore hangs off the site server's startup:

- `api-autostart.ts` (installed into `/home/team/shared/site/`) — if `:8000/api/health`
  does not answer, spawn `decipher-api/supervise.sh start` and
  `supervise.sh ensure-watchdog` detached, then wait (non-blocking) for health.
- `vite.config.ts` — a `configureServer` plugin calls it when the dev server starts.
- `serve.ts` — calls it when the production server starts (`bun run start`).

Both entry points matter because the platform may boot the site in either mode.

Recovery timeline measured on 2026-11-02: API killed → site server restart →
API healthy again in ~2s (`/home/team/shared/site/.run/api-autostart.log`).

### One trap this avoids

The site server's own environment (`site/.env`) contains a *different*
`STRIPE_WEBHOOK_SECRET` and `BACKEND_URL`. `dotenv` in the API does **not**
override inherited variables, so a naive spawn from the site process silently
changed which secret webhook signatures were verified against. `api-autostart.ts`
strips every key the API reads from its own `.env` before spawning, so the API
sees exactly the environment it had when started by hand (platform
`/etc/profile.d` vars + `decipher-api/.env`).

## Files

| file | what it is |
| --- | --- |
| `api-autostart.ts` | the hook; installed into the site dir (copied verbatim) |
| `install-boot-hook.sh` | idempotent installer — run after a site template reset |
| `verify-durability.sh` | kills the API + watchdog, restarts the site server, proves recovery |

## Verify it

```bash
bash api/ops/verify-durability.sh
```

Expected: `public /api/health` is non-200 after the kill and `200` again after the
site server restart, with no manual step in between.

## What is still manual

- A code change to the API still needs `bash /home/team/shared/deploy.sh`-style
  action on this box (the API is not on Vercel; see below). Durability of the
  *process*, not of *code deployment*, is what this fixes.
- `api/supervise.sh install-autostart` still exists but is now pointless: it
  writes to `/etc`, which is wiped. Use `api/ops/install-boot-hook.sh`.

## Why the API is not on Vercel

Running the API as part of the existing Vercel project was investigated and
rejected for launch, on these concrete blockers:

1. **Evidence uploads need a disk.** `routes/entries.js` uses `multer.diskStorage`
   into `uploads/` and stores the file path in `evidence_files`. Vercel functions
   have an ephemeral, read-only filesystem (only `/tmp`, wiped per instance), so
   every uploaded piece of evidence would be lost — and evidence is the core of
   the product. Keeping it would need a new object store (paid infra) or a rewrite
   of the upload path.
2. **The build cannot resolve `savid-engine`.** `api/package.json` depends on
   `file:../savid-engine`, which is not in this repository (that is why PR #8
   added `api/` to `.vercelignore`).
3. **No Git integration on the Vercel project** (`gitRepository: null`), so
   deployments are manual CLI uploads anyway.
