"""Server-side auth sessions (JWT refresh JTI) and activity tracking."""

from __future__ import annotations

import uuid
from typing import Any

from django.core.cache import cache
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserAuthSession


def get_client_ip(request) -> str | None:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()[:45] or None
    addr = request.META.get("REMOTE_ADDR")
    return str(addr)[:45] if addr else None


def _normalize_client_kind(raw: str | None) -> str:
    if not raw:
        return UserAuthSession.ClientKind.UNKNOWN
    v = str(raw).lower().strip()
    valid = {c.value for c in UserAuthSession.ClientKind}
    if v in valid:
        return v
    return UserAuthSession.ClientKind.UNKNOWN


def create_session_on_login(
    *,
    user,
    refresh_token_str: str,
    request,
    device_context: dict[str, Any] | None,
) -> UserAuthSession:
    refresh = RefreshToken(refresh_token_str)
    jti = refresh.payload.get("jti")
    if not jti:
        raise TokenError("missing jti")

    ctx = device_context if isinstance(device_context, dict) else {}
    client_kind = _normalize_client_kind(ctx.get("client"))
    device_label = str(ctx.get("device_label") or "")[:200]
    app_version = str(ctx.get("app_version") or "")[:80]
    platform = str(ctx.get("platform") or "")[:120]

    ua = (request.META.get("HTTP_USER_AGENT") or "")[:4000]

    return UserAuthSession.objects.create(
        user=user,
        refresh_jti=str(jti),
        client_kind=client_kind,
        device_label=device_label,
        app_version=app_version,
        platform=platform,
        user_agent=ua,
        ip_address=get_client_ip(request),
    )


def sync_session_jti_after_refresh(*, old_refresh_str: str, new_refresh_str: str) -> None:
    """After SimpleJWT rotation: move session row from old JTI to new JTI."""
    try:
        old = RefreshToken(old_refresh_str)
        old_jti = old.payload.get("jti")
    except TokenError:
        old_jti = None
    if not old_jti:
        return
    try:
        new = RefreshToken(new_refresh_str)
        new_jti = new.payload.get("jti")
    except TokenError:
        return
    if not new_jti or new_jti == old_jti:
        return
    updated = UserAuthSession.objects.filter(
        refresh_jti=str(old_jti),
        revoked_at__isnull=True,
    ).update(
        refresh_jti=str(new_jti),
        last_seen_at=timezone.now(),
    )
    if not updated:
        UserAuthSession.objects.filter(
            refresh_jti=str(old_jti),
        ).update(
            refresh_jti=str(new_jti),
            last_seen_at=timezone.now(),
        )


def revoke_session_by_refresh_token(*, refresh_token_str: str, user_id) -> bool:
    """Blacklist refresh and mark session revoked (logout)."""
    try:
        token = RefreshToken(refresh_token_str)
        jti = str(token.payload.get("jti") or "")
    except TokenError:
        return False
    if not jti:
        return False
    try:
        token.blacklist()
    except Exception:
        pass
    qs = UserAuthSession.objects.filter(refresh_jti=jti, user_id=user_id)
    return bool(qs.update(revoked_at=timezone.now()))


def revoke_session_by_id_for_user(*, session_id: uuid.UUID, user) -> bool:
    """
    End another device session (LinkedIn-style).
    Blacklists that refresh token via OutstandingToken.
    """
    try:
        session = UserAuthSession.objects.get(
            id=session_id,
            user=user,
            revoked_at__isnull=True,
        )
    except UserAuthSession.DoesNotExist:
        return False
    try:
        ot = OutstandingToken.objects.get(jti=session.refresh_jti, user=user)
        RefreshToken(ot.token).blacklist()
    except Exception:
        pass
    session.revoked_at = timezone.now()
    session.save(update_fields=["revoked_at"])
    return True


def touch_session_last_seen(request, user) -> None:
    # WSGI encodes X-Session-Id as HTTP_X_SESSION_ID
    sid = request.META.get("HTTP_X_SESSION_ID")
    if not sid:
        return
    try:
        sid_uuid = uuid.UUID(str(sid))
    except (ValueError, TypeError):
        return
    key = f"wom_sess_touch:{sid_uuid}"
    if cache.get(key):
        return
    updated = UserAuthSession.objects.filter(
        id=sid_uuid,
        user_id=user.pk,
        revoked_at__isnull=True,
    ).update(last_seen_at=timezone.now())
    if updated:
        cache.set(key, 1, 300)
