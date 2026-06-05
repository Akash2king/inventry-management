"""Tray notifications via OneSignal REST API (https://documentation.onesignal.com/reference/create-notification)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

ONESIGNAL_API_URL = "https://api.onesignal.com/notifications"


def is_onesignal_configured() -> bool:
    app_id = (getattr(settings, "ONESIGNAL_APP_ID", "") or "").strip()
    rest_key = (getattr(settings, "ONESIGNAL_REST_API_KEY", "") or "").strip()
    return bool(app_id and rest_key and getattr(settings, "ONESIGNAL_PUSH_ENABLED", True))


def push_data_for_navigation(meta: dict[str, Any]) -> dict[str, str]:
    """
    Build OneSignal `data` payload for deep-linking when the user taps the notification.
    """
    kind = str(meta.get("kind") or "").strip().lower()
    rid = meta.get("record_id")
    has_record = rid not in (None, "", False)

    out: dict[str, str] = {}
    if kind:
        out["kind"] = kind[:80]

    if has_record:
        out["screen"] = "RecordDetail"
        out["recordId"] = str(rid).strip()
        rn = meta.get("record_number")
        if rn not in (None, "", False):
            out["recordTitle"] = str(rn).strip()[:120]
        return out

    if kind == "monthly_report":
        out["screen"] = "GmConsole"
        return out

    out["screen"] = "InAppNotifications"
    return out


def _post_onesignal_payload(payload: dict, *, log_target: str) -> tuple[int, str | None]:
    """POST to OneSignal. Returns (1, None) on success else (0, error_hint)."""
    app_id = (getattr(settings, "ONESIGNAL_APP_ID", "") or "").strip()
    rest_key = (getattr(settings, "ONESIGNAL_REST_API_KEY", "") or "").strip()
    if not app_id or not rest_key:
        return 0, "ONESIGNAL_REST_API_KEY is not set in waste_oil_backend/.env"

    payload = {**payload, "app_id": app_id}
    headers = {
        "Content-Type": "application/json; charset=UTF-8",
        "Authorization": f"Key {rest_key}",
    }
    req = urllib.request.Request(
        ONESIGNAL_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")[:1200]
        logger.warning("onesignal_push_http_error target=%s code=%s body=%s", log_target, exc.code, err_body)
        return 0, err_body or f"HTTP {exc.code}"
    except urllib.error.URLError as exc:
        logger.warning("onesignal_push_url_error target=%s exc=%s", log_target, exc)
        return 0, str(exc)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.warning("onesignal_push_invalid_json exc=%s raw_prefix=%s", exc, raw[:200])
        return 0, "Invalid OneSignal response"

    if parsed.get("errors"):
        err = parsed.get("errors")
        logger.warning("onesignal_push_api_errors target=%s errors=%s", log_target, err)
        return 0, str(err)

    logger.info(
        "onesignal_push_sent target=%s notification_id=%s",
        log_target,
        parsed.get("id"),
    )
    return 1, None


def send_onesignal_push(
    *,
    external_user_ids: list[str] | None = None,
    subscription_ids: list[str] | None = None,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> int:
    """
    Send a tray notification via OneSignal.
    Targets users by external_id (OneSignal.login) and/or subscription IDs from the app.
    Returns 1 if any send succeeded, else 0.
    """
    if not getattr(settings, "ONESIGNAL_PUSH_ENABLED", True):
        logger.info("onesignal_push_disabled")
        return 0

    if not is_onesignal_configured():
        logger.warning("onesignal_push_not_configured — set ONESIGNAL_REST_API_KEY in .env")
        return 0

    base = {
        "target_channel": "push",
        "headings": {"en": (title or "")[:200] or "Chem-Solv Inventory"},
        "contents": {"en": (body or "")[:4000] or "New workflow notification."},
    }
    if data:
        base["data"] = data

    sent = 0
    ext = [str(x).strip() for x in (external_user_ids or []) if str(x).strip()]
    if ext:
        payload = {**base, "include_aliases": {"external_id": ext[:2000]}}
        sent, _ = _post_onesignal_payload(payload, log_target=f"external_id:{ext[:3]}")

    if sent:
        return 1

    subs = [str(x).strip() for x in (subscription_ids or []) if str(x).strip()]
    if subs:
        payload = {**base, "include_subscription_ids": subs[:2000]}
        sent, _ = _post_onesignal_payload(payload, log_target=f"subscription:{subs[:2]}")
    return sent
