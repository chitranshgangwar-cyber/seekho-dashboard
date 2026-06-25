# Seekho Creative Intelligence — Vercel deploy (Google `@seekhoapp.com` login)

A self-contained React/Recharts dashboard, served behind a Google sign-in that **only allows
`@seekhoapp.com` accounts**. Vercel rebuilds it on every push, and once a day it re-pulls data
straight from Redash — **you never export a CSV by hand**.

---
## How it works

```
        Vercel build (on every deploy)                                Browser
 ┌──────────────────────────────────────────────┐
 │ 1 refresh_data.py  → pulls 3 Redash queries   │      ┌───────────────────────────┐
 │     • Creative Analytics  (Meta spend, hook)  │      │  /  → "Sign in with Google"│
 │     • Creative Dashboard 2 (campaign + funnel)│      │        @seekhoapp.com only  │
 │     • Raw Data Campaign Type (Scaling/Testing)│      └───────────────┬───────────┘
 │ 2 prep_ncad.py     → data_ncad.js (numbers)   │   Google OAuth ←─────┘
 │ 3 esbuild+tailwind → bundle + css             │      ┌───────────────────────────┐
 │ 4 assemble.py      → dashboard/index.html     │ ───▶ │ /dashboard (auth-gated)    │
 │ 5 next build       → auth wrapper             │      │  the offline dashboard     │
 └──────────────────────────────────────────────┘      └───────────────────────────┘
```

- **Login** (`app/page.tsx` + `auth.ts`): Google provider; the `signIn` callback rejects any email
  that isn't a verified `@seekhoapp.com`.
- **Dashboard** (`app/dashboard/route.ts`): checks the session, then streams the prebuilt
  `dashboard/index.html`. No session → bounced to the login page.
- **Data**: the 3 Redash queries are pulled **at build time**, so a rebuild = fresh data. l90d and
  the old 50889 funnel are not used — Creative Dashboard 2 carries the funnel counts itself.

---
## One-time setup (≈15 min)

### 1 · Google OAuth credentials
1. [console.cloud.google.com](https://console.cloud.google.com) → pick/create a project.
2. **APIs & Services → OAuth consent screen** → *Internal* (this alone restricts it to your
   Workspace), fill app name + support email, save.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → *Web application*.
   - **Authorized redirect URIs** → add (you'll update the domain after the first deploy):
     `https://<your-vercel-domain>/api/auth/callback/google`
     and for local dev `http://localhost:3000/api/auth/callback/google`
   - Copy the **Client ID** and **Client secret**.

### 2 · Push to a private GitHub repo
```bash
git init && git add . && git commit -m "init"
git remote add origin git@github.com:<org>/seekho-dashboard.git
git push -u origin main          # keep the repo Private
```

### 3 · Import into Vercel
1. [vercel.com/new](https://vercel.com/new) → **Import** the repo. Framework auto-detects **Next.js**.
   (The build command is already set in `vercel.json` — leave it as is.)
2. **Settings → Environment Variables** — add all of these (Production + Preview):

   | name | value |
   |---|---|
   | `AUTH_GOOGLE_ID` | the OAuth Client ID |
   | `AUTH_GOOGLE_SECRET` | the OAuth Client secret |
   | `AUTH_SECRET` | run `openssl rand -base64 32` and paste the result |
   | `REDASH_BASE_URL` | `https://analytics.seekho.in` |
   | `REDASH_API_KEY` | your Redash API key (Redash → profile → API Key) |
   | `Q_CREATIVE_ANALYTICS` | query id of the Creative-Analytics query |
   | `Q_CREATIVE_DASHBOARD2` | query id of Creative Dashboard 2 |
   | `Q_RAW` | query id of the Raw-Data Campaign-Type query |

   *(query id = the number in `analytics.seekho.in/queries/<id>`)*
3. **Deploy.** First build takes a few min (it pulls ~230 MB from Redash + builds).
4. Copy your real domain (e.g. `seekho-dashboard.vercel.app`) and **add it to the Google redirect
   URI** from step 1 if you used a placeholder. Re-deploy once.

### 4 · Daily auto-refresh (no manual CSVs)
1. Vercel → **Settings → Git → Deploy Hooks** → create one (name `daily`, branch `main`) → copy the URL.
2. GitHub repo → **Settings → Secrets and variables → Actions** → new secret
   `VERCEL_DEPLOY_HOOK` = that URL.
3. Done. `.github/workflows/refresh.yml` already curls it every morning (07:00 IST), which triggers a
   Vercel rebuild → fresh Redash data. (No GitHub deploy hook? Use cron-job.org to POST the same URL.)

---
## Changing the dashboard later
Just edit and push — Vercel rebuilds and redeploys in ~2–3 min:
- **Look / charts / tabs / filters** → `entry_ncad.jsx`
- **Numbers / categories / exclusions / stage logic** → `prep_ncad.py`
- **Login page / who's allowed** → `app/page.tsx`, `auth.ts` (`ALLOWED_DOMAIN`)
```bash
git commit -am "tweak" && git push      # → live shortly
```
You can even edit on github.com directly; the push still triggers the deploy.

---
## Run locally (optional)
```bash
cp .env.example .env.local        # fill in the values
npm install
# put the 3 CSVs in ./data (or run: python3 refresh_data.py with the env vars set)
bash build_dashboard.sh           # builds dashboard/index.html
npm run dev                       # http://localhost:3000
```

---
## Notes
- **Private + correct:** repo is private, hosting is gated to `@seekhoapp.com`, so spend/CAC stay internal.
- **Fails loud:** if a Redash query's columns change, the build fails (it won't silently ship wrong
  numbers) — ping whoever maintains `prep_ncad.py` to adjust.
- **Heads-up:** the build runs `pip install pandas numpy` + `python3 prep_ncad.py` on Vercel. If your
  Vercel plan's build container ever struggles with that, the fallback is to move steps 1–4 into a
  GitHub Action that commits `data_ncad.js`, leaving Vercel to run only `next build` — ask and it's a
  small change.
