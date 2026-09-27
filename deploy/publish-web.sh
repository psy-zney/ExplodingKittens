#!/usr/bin/env bash
# Publish a compatible UI release without restarting the in-memory game server.
set -euo pipefail
cd /home/ubuntu/exxplore-kittens
sudo -n docker compose config --quiet
sudo -n nginx -t
curl --fail --silent --show-error http://127.0.0.1:3105/health >/dev/null
backend_before=$(sudo -n docker inspect --format='{{.Id}} {{.State.StartedAt}}' exxplore-kittens-game-server-1)
sudo -n docker compose build game-server

stage=$(mktemp -d /tmp/exxplore-kittens-web.XXXXXX)
container="exxplore-kittens-web-$(date +%s)-$$"
cleanup() {
    sudo -n docker rm "${container}" >/dev/null 2>&1 || true
    case "${stage}" in /tmp/exxplore-kittens-web.*) sudo -n rm -rf -- "${stage}" ;; esac
}
trap cleanup EXIT
sudo -n docker create --name "${container}" exxplore-kittens-server:local >/dev/null
sudo -n docker cp "${container}:/app/public/." "${stage}/"
asset=$(sed -n 's/.*src="\([^"]*\)".*/\1/p' "${stage}/index.html")
case "${asset}" in /kittens/assets/*.js) ;; *) printf '%s\n' 'Expected a /kittens/ production build' >&2; exit 1 ;; esac
test -f "${stage}/${asset#/kittens/}"
test -d "${stage}/assets"
backup="/var/backups/exxplore-kittens/web-$(date -u +%Y%m%dT%H%M%SZ)-$$"
sudo -n mkdir -p "${backup}" /var/www/exxplore-kittens/assets
if test -f /var/www/exxplore-kittens/index.html; then
    sudo -n cp /var/www/exxplore-kittens/index.html "${backup}/index.html"
fi
# Keep old hashed assets for already open tabs; publish the new entry last.
sudo -n cp -a "${stage}/assets/." /var/www/exxplore-kittens/assets/
sudo -n find /var/www/exxplore-kittens/assets -type d -exec chmod 755 {} +
sudo -n find /var/www/exxplore-kittens/assets -type f -exec chmod 644 {} +
sudo -n install -m 644 "${stage}/index.html" /var/www/exxplore-kittens/index.next.html
sudo -n mv /var/www/exxplore-kittens/index.next.html /var/www/exxplore-kittens/index.html
backend_after=$(sudo -n docker inspect --format='{{.Id}} {{.State.StartedAt}}' exxplore-kittens-game-server-1)
test "${backend_before}" = "${backend_after}"
printf '%s\n' "Published ${asset}" "Previous index: ${backup}/index.html" 'Backend container and start time unchanged.'
sudo -n docker image inspect --format='{{.Id}}' exxplore-kittens-server:local
bash deploy/verify-release.sh
