#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/exxplore-kittens
if [ ! -f .env ]; then
    cp deploy/vps.env.example .env
fi
sudo -n docker compose config --quiet
# Build before checking connections so a slow build cannot silently interrupt
# an already connected room. Rooms and guest sessions live in this process.
sudo -n docker compose build game-server
connections=$(sudo -n ss -Hnt state established '( sport = :3105 )' | wc -l)
if [ "$connections" -ne 0 ]; then
    printf '%s\n' "Release stopped: $connections backend connection(s) remain. Finish active rooms before replacing the server." >&2
    exit 1
fi
sudo -n docker compose up -d game-server
container_id=$(sudo -n docker compose ps -q game-server)
if [ -z "${container_id}" ]; then
    printf '%s\n' 'Game server container was not created.' >&2
    exit 1
fi
# A running container may still be loading its server modules. Publish the
# static release only after its healthcheck passes; never race an immediate curl.
healthy=0
for attempt in $(seq 1 60); do
    status=$(sudo -n docker inspect --format '{{.State.Health.Status}}' "${container_id}")
    if [ "${status}" = 'healthy' ]; then
        healthy=1
        break
    fi
    if [ "${status}" = 'unhealthy' ]; then
        break
    fi
    sleep 1
done
if [ "${healthy}" -ne 1 ]; then
    printf '%s\n' 'Game server failed its healthcheck; static release was not published.' >&2
    sudo -n docker compose logs --tail 30 game-server >&2
    exit 1
fi
sudo -n install -d -m 755 /var/www/exxplore-kittens
sudo -n docker cp "${container_id}:/app/public/." /var/www/exxplore-kittens/
sudo -n find /var/www/exxplore-kittens -type d -exec chmod 755 {} \;
sudo -n find /var/www/exxplore-kittens -type f -exec chmod 644 {} \;
sudo -n python3 deploy/install-nginx.py
# Nginx reload returns before all workers have switched configuration.
published=0
for attempt in $(seq 1 10); do
    if curl --fail --silent http://localhost:9000/kittens/ | grep -q 'id="root"'; then
        published=1
        break
    fi
    sleep 1
done
if [ "${published}" -ne 1 ]; then
    printf '%s\n' 'Nginx did not serve the production game index.' >&2
    exit 1
fi
curl --fail --silent --show-error http://127.0.0.1:3105/health
curl --fail --silent --show-error http://localhost:9000/kittens/health
