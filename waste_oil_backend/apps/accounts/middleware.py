"""
Block API usage (except auth profile / password change) when JWT user must change password.
Runs after augmenting request.user from Bearer token (DRF runs later too; this is for middleware).
"""

from django.http import JsonResponse
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication


def _normalize_path(path: str) -> str:
    p = path.rstrip("/")
    return p if p else "/"


# Paths allowed while must_change_password is true (normalized, no trailing slash).
_EXEMPT_PATHS = frozenset(
    {
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/api/v1/auth/me",
        "/api/v1/auth/change-password",
        "/api/v1/health",
    }
)

# Under /api/v1/records/ these subpaths are workflow actions (not browse-only).
_RECORDS_ACTION_MARKERS = ("/forward/", "/return/", "/forward-candidates/")


def _allowed_read_only_while_must_change_password(request, path: str) -> bool:
    """
    Allow GET/HEAD so new users can see dashboard analytics sources, shared record
    catalog, and queue summary; mutations stay blocked until password change.
    """
    if request.method not in ("GET", "HEAD"):
        return False
    if path.startswith("/api/v1/admin-console/analytics/"):
        return True
    if path == "/api/v1/workflow/queue" or path.startswith("/api/v1/workflow/queue/"):
        return True
    if path == "/api/v1/records" or path.startswith("/api/v1/records/"):
        if any(marker in path for marker in _RECORDS_ACTION_MARKERS):
            return False
        return True
    return False


def _attach_user_from_jwt(request):
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return
    drf_request = Request(request)
    jwt_auth = JWTAuthentication()
    try:
        pair = jwt_auth.authenticate(drf_request)
        if pair:
            request.user = pair[0]
    except Exception:
        pass


class ForcePasswordChangeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS":
            return self.get_response(request)

        path = _normalize_path(request.path)
        if path.startswith("/api/v1"):
            _attach_user_from_jwt(request)
            user = getattr(request, "user", None)
            if (
                user is not None
                and user.is_authenticated
                and getattr(user, "must_change_password", False)
                and path not in _EXEMPT_PATHS
                and not _allowed_read_only_while_must_change_password(request, path)
                and not path.startswith("/admin")
            ):
                return JsonResponse(
                    {
                        "detail": "You must change your password before continuing.",
                        "code": "password_change_required",
                    },
                    status=403,
                )

        return self.get_response(request)
