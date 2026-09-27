#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/exxplore-kittens
sudo -n nginx -t
sudo -n docker compose config --quiet
bash -n deploy/start-release.sh
bash -n deploy/publish-web.sh
sudo -n docker compose ps
for url in http://127.0.0.1:3105/health http://localhost:9000/health http://localhost:9000/kittens/health; do
    curl --fail --silent --show-error "${url}"
    printf '\n'
done
curl --fail --silent --show-error -H 'Host:beatsync-server.zney295.id.vn' http://127.0.0.1:9000/kittens/health
curl --fail --silent --show-error -H 'Host:unmatched.example' http://127.0.0.1:9000/gateway-health
index=$(curl --fail --silent --show-error http://localhost:9000/kittens/)
printf '%s' "${index}" | grep -q 'id="root"'
asset=$(printf '%s\n' "${index}" | sed -n 's/.*src="\([^"]*\)".*/\1/p')
case "${asset}" in /kittens/assets/*.js) ;; *) printf '%s\n' 'Invalid production asset path' >&2; exit 1;; esac
curl --fail --silent --show-error --output /dev/null "http://localhost:9000${asset}"
# Public media can accidentally fall through to index.html with HTTP 200.
# Compare actual bytes for every checked-in GIF/MP3/public resource.
media_count=0
while IFS= read -r -d '' resource; do
    relative="${resource#apps/web/public/}"
    expected=$(sha256sum "$resource" | cut -d ' ' -f 1)
    actual=$(curl --fail --silent --show-error "http://localhost:9000/kittens/$relative" | sha256sum | cut -d ' ' -f 1)
    if [ "$actual" != "$expected" ]; then
        printf '%s\n' "Public media mismatch: $relative" >&2
        exit 1
    fi
    media_count=$((media_count + 1))
done < <(find apps/web/public -type f -print0)
printf '%s\n' "Verified $media_count public media files."
curl --fail --silent --show-error http://localhost:9000/kittens/room/check | grep -q 'id="root"'
missing=$(curl --silent --output /dev/null --write-out '%{http_code}' http://localhost:9000/kittens/assets/not-present.js)
test "${missing}" = '404'
curl --fail --silent --show-error 'http://localhost:9000/kittens/socket.io/?EIO=4&transport=polling' | grep -q 'websocket'
printf '\n%s\n' 'Production HTTP, static assets, SPA fallback, polling and gateway config verified.'
