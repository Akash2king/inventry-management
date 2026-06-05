import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403, F401

DEBUG = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

if not os.environ.get("DATABASE_URL", "").strip():
    raise ImproperlyConfigured(
        "DATABASE_URL is required in production. "
        "Set it in waste_oil_backend/.env or the host environment "
        "(e.g. Aiven: postgres://user:pass@host:port/defaultdb?sslmode=require)."
    )

_db = DATABASES["default"]
if _db.get("ENGINE") == "django.db.backends.postgresql":
    _db.setdefault("OPTIONS", {})["sslmode"] = "require"
