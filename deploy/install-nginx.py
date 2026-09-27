"""Install one independent vhost and add a namespaced route to the gateway.

Run on vps-cong with sudo from the release directory. Backups are kept in
/var/backups/exxplore-kittens. No other application location is replaced.
"""
from pathlib import Path
import datetime
import shutil
import subprocess

release = Path(__file__).resolve().parent
gateway = Path('/etc/nginx/sites-enabled/port_9000.conf').resolve()
snippet = Path('/etc/nginx/snippets/kittens-locations.conf')
upgrade_map = Path('/etc/nginx/conf.d/kittens-upgrade.conf')
vhost = Path('/etc/nginx/sites-available/kittens-9000.conf')
enabled = Path('/etc/nginx/sites-enabled/kittens-9000.conf')
backup = Path('/var/backups/exxplore-kittens') / datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
backup.mkdir(parents=True, exist_ok=True)
targets = [gateway, snippet, upgrade_map, vhost]
originals = {p: p.read_bytes() if p.exists() else None for p in targets}
for p, data in originals.items():
    if data is not None:
        (backup / p.name).write_bytes(data)

old = gateway.read_text()
needle = 'server_name beatsync-server.zney295.id.vn;'
include = 'include /etc/nginx/snippets/kittens-locations.conf;'
if needle not in old:
    raise SystemExit('Expected gateway hostname not found; refusing to edit another vhost')
new = old if include in old else old.replace(needle, needle + '\n\n    ' + include, 1)
was_enabled = enabled.exists() or enabled.is_symlink()
try:
    snippet.parent.mkdir(parents=True, exist_ok=True)
    upgrade_map.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(release / 'nginx/kittens-upgrade.conf', upgrade_map)
    shutil.copyfile(release / 'nginx/kittens-locations.conf', snippet)
    shutil.copyfile(release / 'nginx/kittens-9000.conf', vhost)
    gateway.write_text(new)
    if not was_enabled:
        enabled.symlink_to(vhost)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except Exception:
    for p, data in originals.items():
        if data is None:
            p.unlink(missing_ok=True)
        else:
            p.write_bytes(data)
    if not was_enabled:
        enabled.unlink(missing_ok=True)
    subprocess.run(['nginx', '-t'], check=False)
    raise
print(f'Nginx installed. Backup: {backup}')
