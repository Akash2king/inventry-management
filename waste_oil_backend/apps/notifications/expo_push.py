"""Tray notifications via Expo Push API (https://docs.expo.dev/push-notifications/sending-notifications/)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_BATCH_MAX = 100

# Matches expo-notifications channel in waste_oil_expo_app/native/systemNotifications.js
ANDROID_NOTIFICATION_CHANNEL_ID = "workflow-notifications"


def is_expo_push_token(token: str) -> bool:
    t = (token or "").strip()
    return t.startswith("ExponentPushToken[") or t.startswith("ExpoPushToken[")


def expo_push_data_for_navigation(meta: dict[str, Any]) -> dict[str, str]:
    """
    Build Expo `data` payload (string values only) for deep-linking when the user taps the notification.
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


def send_expo_push_batch(messages: list[dict]) -> int:
    """POST messages to Expo. Returns count of tickets with status \"ok\"."""
    if not messages:
        return 0
    if not getattr(settings, "EXPO_PUSH_ENABLED", True):
        logger.info("expo_push_disabled batch_size=%s", len(messages))
        return 0

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }
    access = getattr(settings, "EXPO_ACCESS_TOKEN", "") or ""
    if access:
        headers["Authorization"] = f"Bearer {access}"

    ok_total = 0
    for start in range(0, len(messages), EXPO_BATCH_MAX):
        chunk = messages[start : start + EXPO_BATCH_MAX]
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=json.dumps(chunk).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")[:1200]
            logger.warning("expo_push_http_error code=%s body=%s", exc.code, err_body)
            continue
        except urllib.error.URLError as exc:
            logger.warning("expo_push_url_error exc=%s", exc)
            continue

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.warning("expo_push_invalid_json exc=%s raw_prefix=%s", exc, raw[:200])
            continue

        for item in parsed.get("data") or []:
            if isinstance(item, dict) and item.get("status") == "ok":
                ok_total += 1
            elif isinstance(item, dict) and item.get("status") == "error":
                logger.debug(
                    "expo_push_ticket_error message=%s details=%s",
                    item.get("message"),
                    item.get("details"),
                )

    return ok_total
