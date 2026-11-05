# Deploying the product app

The product app (this repo) is served from Vercel at **https://decipher-repo.vercel.app**.

**Merging a PR to `main` does not deploy it by itself.** The Vercel project has no
Git integration (`gitRepository: null`), so Vercel never sees GitHub pushes. A
merge reaches production only when one of the paths below is used.

> The marketing site in `/home/team/shared/site` is a separate thing — it is not
> this repo and is not deployed through Vercel. Do not confuse the two.

## Path 1 — one command (works today, no dashboard access needed)

```bash
cd /home/team/shared/decipher-repo
npm run deploy          # = bash scripts/deploy.sh
```

`scripts/deploy.sh`:

1. fetches `origin/main` and deploys **that exact commit** from a throwaway
   worktree, so the shared working tree is never modified;
2. uploads it to Vercel as a production deployment and moves the
   `decipher-repo.vercel.app` alias to it;
3. **verifies the live site** — `/`, `/subscribe`, `/success`, `/cancel`,
   `/signup`, `/login`, `/dashboard` must all return 200, the deployment's
   commit must equal the one that was deployed, and the JS the browser actually
   downloads must call the reachable backend, which must answer health and CORS
   for the production origin.

It exits non-zero and prints the failing check if anything is off. Re-check a
running deployment at any time without deploying:

```bash
npm run verify:prod
```

`VERCEL_TOKEN` must be in the environment. On the team box it already is
(`/etc/profile.d/cto-env-vars.sh`).

## Path 2 — true auto-deploy on merge (needs one click from the owner)

`.github/workflows/deploy.yml` deploys on every push to `main`. It is inert
until a repository secret exists:

> GitHub → `nefertirimcbusiness-oss/decipher` → **Settings** → **Secrets and
> variables** → **Actions** → **New repository secret** → Name `VERCEL_TOKEN`,
> Value: a Vercel access token.

After that, a merge to `main` deploys within about a minute, and the workflow
runs the same live verification as Path 1. (A repository admin must do this;
the bot token used by the team cannot create repository secrets.)

## Path 3 — real Vercel ↔ GitHub integration (needs two clicks from the owner)

This is the cleanest end state: Vercel builds on push, preview deployments
included. It cannot be done with an API token — Vercel answers

> `Failed to link nefertirimcbusiness-oss/decipher. You need to add a Login
> Connection to your GitHub account first.`

So the owner has to:

1. Sign in to Vercel **with GitHub** (Account Settings → Login Connections →
   connect GitHub), and install the Vercel GitHub App for the
   `nefertirimcbusiness-oss` organisation.
2. In the `decipher-repo` project → **Settings → Git** → **Connect Git
   Repository** → pick `nefertirimcbusiness-oss/decipher`, production branch
   `main`.

Once `gitRepository` is set, Paths 1 and 2 are unnecessary (they keep working
and are harmless).

## What is excluded from the Vercel deploy

`.vercelignore` excludes `api/`. The Express backend is **not** part of this
deployment — it runs on the team box behind the `-dev` URL that
`src/lib/api.ts` points at. So backend commits (`#12`, `#13`) never ship
through Vercel; they reach production through the API autostart/supervisor
described in `api/ops/README.md`.
