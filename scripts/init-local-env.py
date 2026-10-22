"""Create local-only configuration without overwriting files or displaying credentials."""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
env = root / '.env'
if not env.exists():
    db = root / 'data/db/web-api-dev.sqlite'
    suffix = 2
    while db.exists():
        db = root / f'data/db/web-api-dev-{suffix}.sqlite'
        suffix += 1
    env.write_text(f'DATABASE_URL=sqlite:///{db.as_posix()}\n'
                   f'SECRET_KEY={secrets.token_urlsafe(48)}\n'
                   f'SEED_PASSWORD={secrets.token_urlsafe(24)}\n'
                   'DEMO_MODE=true\nALLOWED_ORIGINS=http://localhost:3000\n', encoding='utf-8')
    print('Created root .env with a separate absolute SQLite path and local credentials.')
else:
    print('Existing root .env preserved; check DATABASE_URL, DEMO_MODE, SECRET_KEY, SEED_PASSWORD locally.')
web = root / 'apps/web/.env.local'
if not web.exists():
    web.write_text('API_BASE_URL=http://127.0.0.1:8000/api/v1\nAPI_TIMEOUT_MS=8000\n', encoding='utf-8')
    print('Created apps/web/.env.local (server-only API URL).')
else:
    print('Existing apps/web/.env.local preserved; check API_BASE_URL locally.')
