# VPS gateway 9000

Game backend listens inside Docker on 3001 and is published to host loopback 3105. Nginx listens on 9000, serving the game at `/kittens/` and proxying Socket.IO at `/kittens/socket.io/`. The dedicated vhost also accepts localhost, the VPS IP and sslip hostname. Existing gateway root routes remain in their original configuration.

The installer backs up the affected config in `/var/backups/exxplore-kittens/<timestamp>`, writes an independent game vhost and snippet, adds one snippet include to the existing `beatsync-server.zney295.id.vn` server, validates `nginx -t`, then reloads. On a validation failure it restores the previous files before exiting.

Live game: https://beatsync-server.zney295.id.vn/kittens/ . Local gateway: http://localhost:9000/kittens/ . Direct IP: http://149.118.50.176:9000/kittens/ . HTTPS uses the existing Cloudflare route; the game's own Node port is not exposed publicly.

Config files installed:

- `/etc/nginx/conf.d/kittens-upgrade.conf`: map in `http{}` selecting Connection upgrade/close according to the request, following the [official Nginx WebSocket guide](https://nginx.org/en/docs/http/websocket.html).
- `/etc/nginx/snippets/kittens-locations.conf`: static alias, SPA fallback, immutable hashed assets, HTTP health and Socket.IO proxy.
- `/etc/nginx/sites-available/kittens-9000.conf`: dedicated 9000 vhost, symlinked in sites-enabled; `/` redirects to `/kittens/`.
- Existing `port_9000.conf`: one namespaced snippet include in the beatsync host; its original application route stays in place.

Socket.IO external path `/kittens/socket.io/` becomes upstream `/socket.io/`. HTTP/1.1, Upgrade, conditional Connection header, forwarding headers, 75-second read/send timeouts and disabled buffering support both polling and WebSocket. The server independently validates exact browser origins on both transports. Static serving uses alias to retain the `/kittens/` URI during index redirects.

Release files are placed at `/home/ubuntu/exxplore-kittens`. Run:

```sh
bash deploy/start-release.sh
bash deploy/verify-release.sh
```

The build uses values in `.env`, initially copied from `deploy/vps.env.example`. After building, the release script refuses container replacement while established connections remain on backend port 3105. Complete connected rooms before a backend maintenance release. It then waits up to 60 seconds for the container healthcheck, then copies static build files from the image's `/app/public` to `/var/www/exxplore-kittens`, with directories 755 and files 644. A failed healthcheck stops the release before publishing static files. The server image runs as the Node user. Compose restart policy is `unless-stopped`; its healthcheck includes a 10-second startup grace period.

The restart guard has two isolated operational checks (connected room and failed build). Run bash scripts/release-guard.test.sh on the VPS. Privileged commands are replaced with a fail-closed shell stub; the checks do not restart Docker or alter Nginx.
### Compatible web updates without restarting rooms

For changes confined to the browser that work with the running socket protocol:

```sh
bash deploy/publish-web.sh
```

This builds the complete production image using the VPS `.env`, creates a temporary container without starting it, and extracts `/app/public`. It validates the `/kittens/` asset prefix, backs up the previous index, publishes hashed assets and public media (GIF/MP3) first, and renames the new index last. Old hashed assets remain for open tabs. It compares the running game container ID and start time before and after publication, then runs the release verification, including byte-for-byte hashes for every public media file. A missing media file returning SPA HTML cannot pass this check. Nginx and the game process are not reloaded. The latest image tag is ready for a future backend maintenance release; the running backend may still use the earlier compatible image. Do not use this procedure for server or socket schema changes.

The previous index is in `/var/backups/exxplore-kittens/web-<UTC timestamp>-<pid>/index.html`. To roll back this UI, copy that specific index back after confirming the saved asset is still available. This does not restore in-memory game state.

Check both local routing and the public HTTPS path:

```sh
curl -f http://127.0.0.1:3105/health
curl -f http://localhost:9000/kittens/health
curl -f https://beatsync-server.zney295.id.vn/kittens/health
curl -i 'https://beatsync-server.zney295.id.vn/kittens/socket.io/?EIO=4&transport=polling'
sudo nginx -t
sudo docker compose ps
```

See [VERCEL.md](VERCEL.md) for the exact Dashboard settings, install command, environment values and build-error diagnosis. To use Vercel, build the same web sources with `VITE_BASE_PATH=/`, `VITE_SERVER_URL=https://beatsync-server.zney295.id.vn` and `VITE_SOCKET_PATH=/kittens/socket.io`. Add that exact web origin to the comma-separated `CORS_ORIGIN` before recreating the backend container. Guest sessions and unfinished rooms currently live in process memory; recreating the container ends them.

```sh
python3 deploy/add-origin.py https://your-project.vercel.app
sudo docker compose up -d game-server
```

Use a maintenance window for updates. Container replacement loses in-memory games; static files are copied into the existing web directory. Old hashed assets remain for open tabs. The installer restores Nginx files on a failed config check, but it does not restore game state or automatically roll back the entire backend release. Saved config backups are not a game database.

There is no claim of multi-server or restart recovery in this release. A stable custom game hostname can be added to the same snippet once DNS and its HTTPS proxy route exist.
