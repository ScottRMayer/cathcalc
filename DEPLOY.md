# Deploying Cath Lab Tools to cathcalc.com

Static PWA hosted free on **GitHub Pages** (public repo). The included
`.github/workflows/deploy.yml` publishes the `app/` folder to the domain root
on every push to `main`. The domain `cathcalc.com` is registered at Namecheap.

Replace `<USERNAME>` with your GitHub username throughout.

## 1. Initialize git locally (PowerShell, in this folder)

A partial `.git` was left by the sandbox and can't be removed remotely — delete
it and start fresh:

```powershell
cd "C:\Users\Scott\Claude\Projects\Cathlab tools"
Remove-Item -Recurse -Force .git
git init -b main
git add -A
git commit -m "Initial commit: Cath Lab Tools PWA"
```

## 2. Create the GitHub repo (public) and push

**With GitHub CLI:**
```powershell
gh repo create cathcalc --public --source=. --remote=origin --push
```

**Or via the website:** create a new **public** repo named `cathcalc` (do NOT add
a README/.gitignore), then:
```powershell
git remote add origin https://github.com/<USERNAME>/cathcalc.git
git push -u origin main
```

## 3. Turn on GitHub Pages

Repo → **Settings → Pages → Build and deployment → Source = "GitHub Actions"**.
The workflow runs automatically and deploys `app/`. The `app/CNAME` file already
sets the custom domain to `cathcalc.com`, so it should appear in the Custom
domain box. Leave "Enforce HTTPS" for step 5.

## 4. Point Namecheap DNS at GitHub

Namecheap → Domain List → **Manage → Advanced DNS**. First **delete** the default
`CNAME @ parkingpage` / "URL Redirect Record" that Namecheap adds. Then add:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A     | @   | 185.199.108.153 | Automatic |
| A     | @   | 185.199.109.153 | Automatic |
| A     | @   | 185.199.110.153 | Automatic |
| A     | @   | 185.199.111.153 | Automatic |
| CNAME | www | `<USERNAME>.github.io.` | Automatic |

Optional IPv6 (add all four as AAAA @):
`2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`

## 5. Verify + HTTPS

DNS propagation is usually minutes, up to ~an hour. Check:
```powershell
nslookup cathcalc.com
```
When the A records resolve to the GitHub IPs, go back to Settings → Pages and
tick **Enforce HTTPS** (GitHub issues the TLS cert automatically). Done —
`https://cathcalc.com` serves the app, and `www` redirects to it.

## Ongoing updates

Edit files under `app/`, bump `VERSION` in `app/sw.js` (so the service worker
serves fresh files), then `git commit` + `git push`. The workflow redeploys.
```powershell
git add -A && git commit -m "..." && git push
```
