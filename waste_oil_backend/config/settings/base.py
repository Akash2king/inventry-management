"""
Shared Django settings for waste_oil_backend.
Environment-specific files (dev, prod) import from here.
"""
import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("SECRET_KEY", "unsafe-dev-only-change-me")

DEBUG = os.environ.get("DEBUG", "False").lower() in ("1", "true", "yes")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]").split(",")
    if h.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "apps.accounts",
    "apps.records",
    "apps.workflow",
    "apps.alerts",
    "apps.audit",
    "apps.notifications",
    "apps.admin_console",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.accounts.middleware.ForcePasswordChangeMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# Database: set DATABASE_URL in waste_oil_backend/.env (loaded above via load_dotenv).
# Local Postgres (no SSL):  postgres://user:pass@127.0.0.1:5432/dbname?sslmode=disable
#   If the password contains @, URL-encode it as %40 (e.g. root@123 → root%40123).
# Cloud Postgres (Aiven):   postgres://user:pass@host:port/defaultdb?sslmode=require
# Omit DATABASE_URL entirely to use SQLite (db.sqlite3) for local dev only.
_database_url = os.environ.get("DATABASE_URL", "").strip()
_sqlite_default = "sqlite:///" + str(BASE_DIR / "db.sqlite3")
_use_postgres = _database_url.startswith(("postgres://", "postgresql://"))


def _postgres_ssl_require(url: str) -> bool:
    """Require SSL for remote Postgres; never force it for local/dev unless asked."""
    if not url.startswith(("postgres://", "postgresql://")):
        return False
    override = os.environ.get("DATABASE_SSL_REQUIRE", "").strip().lower()
    if override in ("0", "false", "no", "disable", "off"):
        return False
    if override in ("1", "true", "yes", "require", "on"):
        return True
    try:
        from urllib.parse import parse_qs, urlparse

        parsed = urlparse(url)
        sslmode = (parse_qs(parsed.query).get("sslmode") or [""])[0].lower()
        if sslmode in ("disable", "allow"):
            return False
        if sslmode in ("prefer",):
            return False
        if sslmode in ("require", "verify-ca", "verify-full"):
            return True
        host = (parsed.hostname or "").lower()
        if host in ("localhost", "127.0.0.1", "::1"):
            return False
    except Exception:
        pass
    # Remote hosts default to SSL (Aiven / managed Postgres).
    return True


DATABASES = {
    "default": dj_database_url.config(
        default=_database_url or _sqlite_default,
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=_postgres_ssl_require(_database_url) if _use_postgres else False,
    )
}

# Honor ?sslmode= from DATABASE_URL when not forcing SSL (local Postgres).
if _use_postgres and not _postgres_ssl_require(_database_url):
    try:
        from urllib.parse import parse_qs, urlparse

        _sslmode = (parse_qs(urlparse(_database_url).query).get("sslmode") or ["disable"])[0]
        DATABASES["default"].setdefault("OPTIONS", {})["sslmode"] = _sslmode
    except Exception:
        DATABASES["default"].setdefault("OPTIONS", {})["sslmode"] = "disable"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.CustomUser"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.middleware.ReuseMiddlewareJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

_access_min = int(os.environ.get("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", "60"))
_refresh_days = int(os.environ.get("JWT_REFRESH_TOKEN_LIFETIME_DAYS", "60"))

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=_access_min),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=_refresh_days),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

_cors_from_env = [
    o.strip()
    for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]
# Default dev frontends: Vite (5173) and Tauri+Vite (1420). Merge with env (e.g. LAN URLs).
_DEFAULT_CORS_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
]
CORS_ALLOWED_ORIGINS = list(dict.fromkeys(_cors_from_env + _DEFAULT_CORS_DEV_ORIGINS))

# Packaged desktop (tauri://) and varied LAN clients cannot be listed exhaustively as
# http/https origins. Reflect any request Origin on preflight and credentialed calls.
CORS_ALLOW_ALL_ORIGINS = True

# Tauri / browser clients send X-Session-Id on JWT requests; it is not in corsheaders'
# default allow-list, so preflight fails with "Failed to fetch" while React Native (Expo)
# does not run browser CORS and appears to work.
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-session-id",
]

EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() in (
    "1",
    "true",
    "yes",
)
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "noreply@example.com")

MANAGER_EMAIL = os.environ.get("MANAGER_EMAIL", "")
GM_EMAIL = os.environ.get("GM_EMAIL", "")

# Shown in welcome emails for new GM-created users (e.g. how to open the desktop app).
FRONTEND_URL = os.environ.get("FRONTEND_URL", "").strip()
WELCOME_EMAIL_APP_HINT = os.environ.get("WELCOME_EMAIL_APP_HINT", "").strip()

REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")

# Shared cache across Gunicorn workers when Redis is available; LocMem otherwise.
_use_redis_cache = os.environ.get("DJANGO_REDIS_CACHE", "true").lower() in (
    "1",
    "true",
    "yes",
)
if _use_redis_cache and REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            "KEY_PREFIX": "wom",
            "TIMEOUT": 300,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "wom-local",
        }
    }

CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_TASK_ALWAYS_EAGER = os.environ.get(
    "CELERY_TASK_ALWAYS_EAGER", ""
).lower() in ("1", "true", "yes")
CELERY_TASK_EAGER_PROPAGATES = True

CELERY_BEAT_SCHEDULE = {
    # Runs once per day at 02:00 server time to evaluate SLA status
    # for all active records and send notifications when they cross
    # into a higher alert band (yellow / orange / red).
    "scan-sla-alerts-daily": {
        "task": "records.scan_sla_alerts",
        "schedule": 60 * 60 * 24,  # every 24 hours
    },
    # Run once per day; the task itself only sends reports on the first of
    # each month for the previous month's data.
    "send-monthly-gm-report": {
        "task": "admin_console.send_monthly_gm_report_email",
        "schedule": 60 * 60 * 24,  # every 24 hours
    },
}

# How many days the SLA window lasts when the storeman does not explicitly set a due_date.
SLA_DAYS = int(os.environ.get("SLA_DAYS", "30"))

# Alert levels are now based on the percentage of the SLA window that has elapsed between
# entry_date and due_date instead of absolute days from entry.
# Example defaults:
#   < 60%  -> green
#   60–79% -> yellow
#   80–89% -> orange
#   >= 90% -> red
ALERT_YELLOW_PERCENT = int(os.environ.get("ALERT_YELLOW_PERCENT", "60"))
ALERT_ORANGE_PERCENT = int(os.environ.get("ALERT_ORANGE_PERCENT", "80"))
ALERT_RED_PERCENT = int(os.environ.get("ALERT_RED_PERCENT", "90"))

# Backwards‑compatibility: if legacy absolute thresholds are provided but the new
# percentage‑based variables are not, derive rough equivalents so existing installs
# continue to behave reasonably until they are migrated.
_legacy_yellow = os.environ.get("YELLOW_THRESHOLD")
_legacy_red = os.environ.get("RED_THRESHOLD")
if _legacy_yellow and not os.environ.get("ALERT_YELLOW_PERCENT"):
    try:
        ALERT_YELLOW_PERCENT = max(10, min(90, int(_legacy_yellow) * 100 // SLA_DAYS))
    except ValueError:
        pass
if _legacy_red and not os.environ.get("ALERT_RED_PERCENT"):
    try:
        ALERT_RED_PERCENT = max(10, min(99, int(_legacy_red) * 100 // SLA_DAYS))
    except ValueError:
        pass

# Optional switch to fully disable outbound email notifications without breaking anything.
EMAIL_NOTIFICATIONS_ENABLED = (
    os.environ.get("EMAIL_NOTIFICATIONS_ENABLED", "true").lower()
    in ("1", "true", "yes")
)

# Mobile workflow pushes — OneSignal REST API (https://documentation.onesignal.com/reference/create-notification)
ONESIGNAL_APP_ID = os.environ.get("ONESIGNAL_APP_ID", "").strip()
ONESIGNAL_REST_API_KEY = os.environ.get("ONESIGNAL_REST_API_KEY", "").strip()
ONESIGNAL_PUSH_ENABLED = os.environ.get("ONESIGNAL_PUSH_ENABLED", "true").lower() in (
    "1",
    "true",
    "yes",
)

try:
    import config.celery  # noqa: F401 — register Celery app and task modules
except ImportError:
    pass
