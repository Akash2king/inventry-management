"""Send display notifications via Firebase Cloud Messaging HTTP v1 (no Expo Push Service)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from django.conf import settings
from google.auth.transport.requests import Request
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

_FCM_SCOPES = ("https://www.googleapis.com/auth/firebase.messaging",)

# Matches expo-notifications channel in waste_oil_expo_app/native/systemNotifications.js
ANDROID_NOTIFICATION_CHANNEL_ID = "workflow-notifications"


def is_expo_legacy_push_token(token: str) -> bool:
    """Tokens from Expo's push service — not deliverable via our FCM-only backend."""
    t = (token or "").strip()
    return t.startswith("ExponentPushToken[") or t.startswith("ExpoPushToken[")


def _fcm_credentials():
    if not getattr(settings, "FCM_ENABLED", False):
        return None
    path = getattr(settings, "FCM_SERVICE_ACCOUNT_FILE", "") or ""
    raw_json = getattr(settings, "FCM_SERVICE_ACCOUNT_JSON", "") or ""
    if path:
        try:
            return service_account.Credentials.from_service_account_file(
                str(path), scopes=_FCM_SCOPES
            )
        except OSError as exc:
            logger.warning("fcm_service_account_file_unreadable path=%s exc=%s", path, exc)
            return None
        except ValueError as exc:
            logger.warning("fcm_service_account_file_invalid path=%s exc=%s", path, exc)
            return None
    if raw_json.strip():
        try:
            info = json.loads(raw_json)
            return service_account.Credentials.from_service_account_info(
                info, scopes=_FCM_SCOPES
            )
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            logger.warning("fcm_service_account_json_invalid exc=%s", exc)
            return None
    logger.info("fcm_credentials_missing set FCM_SERVICE_ACCOUNT_FILE or FCM_SERVICE_ACCOUNT_JSON")
    return None


def _stringify_data(data: dict[str, Any] | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in (data or {}).items():
        if v is None:
            continue
        out[str(k)] = v if isinstance(v, str) else json.dumps(v)
    return out


def send_fcm_display_message(
    *,
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> bool:
    """
    Send a notification that appears in the system tray when the app is in background or killed.
    """
    creds = _fcm_credentials()
    if not creds:
        return False
    try:
        creds.refresh(Request())
    except Exception as exc:  # pragma: no cover - network / clock skew
        logger.warning("fcm_oauth_refresh_failed exc=%s", exc)
        return False

    project_id = creds.project_id
    if not project_id:
        logger.warning("fcm_project_id_missing in service account")
        return False

    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    payload = {
        "message": {
            "token": token.strip(),
            "notification": {
                "title": (title or "")[:200],
                "body": (body or "")[:4000],
            },
            "android": {
                "priority": "HIGH",
                "notification": {
                    "channel_id": ANDROID_NOTIFICATION_CHANNEL_ID,
                    "default_sound": True,
                },
            },
            "data": _stringify_data(data),
        }
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {creds.token}",
            "Content-Type": "application/json; charset=UTF-8",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            ok = 200 <= getattr(resp, "status", 200) < 300
            if not ok:
                logger.warning("fcm_unexpected_status status=%s", getattr(resp, "status", "?"))
            return ok
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")[:800]
        logger.warning(
            "fcm_send_http_error code=%s token_prefix=%s body=%s",
            exc.code,
            token.strip()[:16],
            err_body,
        )
        return False
    except urllib.error.URLError as exc:
        logger.warning("fcm_send_url_error exc=%s", exc)
        return False
