"""
Block API usage (except auth profile / password change) when JWT user must change password.
Runs after augmenting request.user from Bearer token (DRF runs later too; this is for middleware).
"""

from django.http import JsonResponse
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication

from .session_service import touch_session_last_seen


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


def _password_flow_exempt_path(path: str) -> bool:
    """Allow session + in-app notification APIs while must_change_password is true."""
    if path in _EXEMPT_PATHS:
        return True
    if path.startswith("/api/v1/auth/sessions"):
        return True
    if path.startswith("/api/v1/notifications"):
        return True
    return False


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


_jwt_auth = JWTAuthentication()


def _attach_user_from_jwt(request):
    """Authenticate once and mark so DRF JWTAuthentication can reuse request.user."""
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return
    if getattr(request, "user", None) is not None and getattr(
        request.user, "is_authenticated", False
    ):
        request._force_auth_user = request.user
        return
    drf_request = Request(request)
    try:
        pair = _jwt_auth.authenticate(drf_request)
        if pair:
            request.user = pair[0]
            request._force_auth_user = pair[0]
            request._force_auth_token = pair[1]
    except Exception:
        pass


class ReuseMiddlewareJWTAuthentication(JWTAuthentication):
    """Skip a second DB user load when middleware already authenticated the JWT."""

    def authenticate(self, request):
        forced = getattr(request._request, "_force_auth_user", None) if hasattr(request, "_request") else None
        if forced is None:
            forced = getattr(request, "_force_auth_user", None)
        if forced is not None and getattr(forced, "is_authenticated", False):
            token = getattr(getattr(request, "_request", request), "_force_auth_token", None)
            return (forced, token)
        return super().authenticate(request)


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
            if user is not None and getattr(user, "is_authenticated", False):
                touch_session_last_seen(request, user)
            if (
                user is not None
                and user.is_authenticated
                and getattr(user, "must_change_password", False)
                and not _password_flow_exempt_path(path)
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
