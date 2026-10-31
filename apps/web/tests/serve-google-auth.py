"""Loopback-only OAuth integration server; Google identity is synthetic, never a real account."""
import os
from pathlib import Path
import secrets
import tempfile

root = Path(__file__).resolve().parents[3]
(root / ".tmp").mkdir(exist_ok=True)
folder = tempfile.TemporaryDirectory(prefix="google-auth-", dir=root / ".tmp")
os.environ.update(
    DATABASE_URL=f"sqlite:///{(Path(folder.name) / 'test.sqlite').as_posix()}",
    SECRET_KEY=secrets.token_urlsafe(32), DEMO_MODE="false", COOKIE_SECURE="false",
    GEMINI_API_KEY="", GOOGLE_CLIENT_ID="test-client.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET="synthetic-google-secret", REGISTER_RATE_LIMIT="1000",
    GOOGLE_REDIRECT_URI="http://127.0.0.1:3013/api/auth/google/callback",
)

from app.core import db
from app.core.errors import ApiError
from app.main import create_app
from app.services import auth_google

db.configure()
db.Base.metadata.create_all(db.engine())


async def synthetic_identity(code, verifier, settings):
    if code != "synthetic-code":
        raise ApiError(401, code="google_denied", message="Synthetic provider rejected code")
    return "synthetic-google-subject", "synthetic@example.com"


auth_google.identity = synthetic_identity
app = create_app()
