# Deploy / Takedown Notes — Seymour Learning Insights site

Hosting: **Cloudflare Pages** (project deleted while Ryan is still at Amplify; relaunch when ready).

## Key identifiers (not secrets)
- Cloudflare account ID: `15e0abec0db293b103f8344a442a17dc`
- Zone ID (seymourlearning.com): `f8945238b70125ae0831647fa1e147e8`
- Pages project name: `seymourlearning`  → serves at `seymourlearning.pages.dev`
- Custom domains: `seymourlearning.com`, `www.seymourlearning.com`
- Nameservers: `lana.ns.cloudflare.com`, `guy.ns.cloudflare.com`
- Auth: Wrangler OAuth already stored (`~/Library/Preferences/.wrangler/config/default.toml`).
  Has `pages:write` (deploy + attach domains) but NOT DNS — DNS record changes need a separate
  **Zone:DNS:Edit** API token (create per-use, revoke after).

## TO RELAUNCH (turn the site back on)
1. Run: `bash ~/seymour-learning-insights-site/redeploy.sh`
   (creates project, deploys files, re-attaches custom domains)
2. Recreate the two DNS records (needs a Zone:DNS:Edit token):
   - `CNAME  seymourlearning.com  -> seymourlearning.pages.dev`  (Proxy ON)
   - `CNAME  www                  -> seymourlearning.pages.dev`  (Proxy ON)
   API: `POST https://api.cloudflare.com/client/v4/zones/<ZONE>/dns_records`
        body `{"type":"CNAME","name":"<name>","content":"seymourlearning.pages.dev","proxied":true}`
3. Wait a few min for SSL cert to provision → https://seymourlearning.com is live.

Fastest path: just tell Claude "put the site back up," create a DNS token when asked, done.

## TO TAKE DOWN AGAIN
1. Delete the two DNS CNAME records (Zone:DNS:Edit token).
2. Detach custom domains: `DELETE .../pages/projects/seymourlearning/domains/<domain>` (OAuth).
3. Delete project: `npx wrangler pages project delete seymourlearning --yes`.

## Source of truth
The site is `index.html` (+ og-image.png/svg, ryan-seymour.jpg) in this repo, also on GitHub
(`ryseymour/seymour-learning-insights-site`). Edit → run redeploy.sh to push live.
