import os

from .base import *  # noqa: F403, F401

DEBUG = True

# Celery without Redis (local dev): tasks run in-process; no broker/result TCP.
# Set USE_REDIS_CELERY=1 in .env if you run Redis +: celery -A config worker -l info
CELERY_TASK_EAGER_PROPAGATES = True
_use_redis_celery = os.environ.get("USE_REDIS_CELERY", "").lower() in ("1", "true", "yes")
if not _use_redis_celery:
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_BROKER_URL = "memory://"
    CELERY_RESULT_BACKEND = "cache+memory://"

# Optional: django-debug-toolbar (only if installed)
try:
    import debug_toolbar  # noqa: F401

    INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405
    MIDDLEWARE.insert(1, "debug_toolbar.middleware.DebugToolbarMiddleware")  # noqa: F405
    INTERNAL_IPS = ["127.0.0.1", "::1"]
except ImportError:
    pass
