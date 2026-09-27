"""Add an exact frontend origin to this game's .env; never print credentials."""
from pathlib import Path
from urllib.parse import urlsplit
import sys

origin = sys.argv[1]
url = urlsplit(origin)
if url.scheme not in ('http', 'https') or not url.netloc or url.path or url.query or url.fragment or url.username or url.password:
    raise SystemExit('Expected an exact HTTP(S) origin without a path')
env = Path(__file__).resolve().parent.parent / '.env'
lines = env.read_text().splitlines()
for index, line in enumerate(lines):
    if line.startswith('CORS_ORIGIN='):
        origins = line.split('=', 1)[1].split(',')
        if origin not in origins:
            lines[index] = line + ',' + origin
        break
else:
    raise SystemExit('CORS_ORIGIN is missing; refusing to replace the environment')
env.write_text('\n'.join(lines) + '\n')
print('Frontend origin configured. Recreate the game container to apply.')
