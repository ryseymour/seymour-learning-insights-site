#!/usr/bin/env bash
# Re-launch the Seymour Learning Insights site on Cloudflare Pages.
# Usage: bash redeploy.sh
# Prereqs: Node + Wrangler (npx) available; `wrangler login` already done (stored OAuth).
set -e
export PATH="/opt/homebrew/bin:$PATH"

SITE_DIR="$HOME/seymour-learning-insights-site"
PUB="/tmp/sli-publish"
PROJECT="seymourlearning"
ACCT="15e0abec0db293b103f8344a442a17dc"

echo "==> Building clean publish dir"
rm -rf "$PUB"; mkdir -p "$PUB"
cp "$SITE_DIR/index.html" "$SITE_DIR/og-image.png" "$SITE_DIR/og-image.svg" "$SITE_DIR/ryan-seymour.jpg" "$SITE_DIR/robots.txt" "$SITE_DIR/sitemap.xml" "$PUB/"

echo "==> Creating Pages project (ok if it already exists)"
npx --yes wrangler pages project create "$PROJECT" --production-branch=main 2>/dev/null || true

echo "==> Deploying"
npx --yes wrangler pages deploy "$PUB" --project-name="$PROJECT" --branch=main --commit-dirty=true

echo "==> Re-attaching custom domains"
TOKEN=$(grep '^oauth_token' "$HOME/Library/Preferences/.wrangler/config/default.toml" | sed 's/oauth_token = //; s/"//g')
for D in seymourlearning.com www.seymourlearning.com; do
  curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCT/pages/projects/$PROJECT/domains" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data "{\"name\":\"$D\"}" >/dev/null && echo "    attached $D"
done

cat <<EOF

==> Site is live at https://$PROJECT.pages.dev
==> LAST STEP — recreate the two DNS records (needs a Zone:DNS:Edit API token):
    CNAME  seymourlearning.com  ->  $PROJECT.pages.dev   (Proxy ON)
    CNAME  www                  ->  $PROJECT.pages.dev   (Proxy ON)
    (Create token at dash.cloudflare.com/profile/api-tokens -> "Edit zone DNS" template,
     then Claude can add both records via API in seconds.)
EOF
