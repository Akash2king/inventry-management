"""Persisted in-app notifications: workflow/email parity helpers."""

from __future__ import annotations

import logging
from typing import Any

from django.contrib.auth import get_user_model

from apps.notifications.models import UserNotification

logger = logging.getLogger(__name__)


def users_from_email_recipients(recipients: list[str]) -> list:
    """Map raw email strings to app users (case-insensitive)."""
    User = get_user_model()
    out: list = []
    seen: set[str] = set()
    for raw in recipients or []:
        e = (raw or "").strip()
        if not e:
            continue
        key = e.lower()
        if key in seen:
            continue
        seen.add(key)
        u = User.objects.filter(email__iexact=e).first()
        if u is not None:
            out.append(u)
    return out


def mirror_email_as_user_notification(
    user,
    *,
    kind: str,
    email_subject: str,
    email_body_text: str,
    metadata: dict[str, Any] | None = None,
) -> UserNotification | None:
    """
    Persist the same subject/body as the workflow email so mobile + desktop
    notification feeds match the inbox.
    """
    if user is None or not getattr(user, "pk", None):
        return None
    valid = {c.value for c in UserNotification.Kind}
    if kind not in valid:
        logger.warning("mirror_email_as_user_notification unknown kind=%s", kind)
        return None
    title = (email_subject or "").strip()[:200] or "Chem-Solv Inventory"
    body = (email_body_text or "").strip()
    return UserNotification.objects.create(
        user=user,
        kind=kind,
        title=title,
        body=body,
        metadata=metadata or {},
    )


def mirror_email_as_user_notification_and_push(
    user,
    *,
    kind: str,
    email_subject: str,
    email_body_text: str,
    metadata: dict[str, Any] | None = None,
) -> UserNotification | None:
    note = mirror_email_as_user_notification(
        user,
        kind=kind,
        email_subject=email_subject,
        email_body_text=email_body_text,
        metadata=metadata,
    )
    if note is not None:
        try:
            from apps.notifications.tasks import send_pushes_task

            send_pushes_task.delay(
                [user.pk],
                note.title,
                note.body,
                metadata or {},
            )
        except Exception:
            logger.warning("push_send_failed for user=%s", getattr(user, "pk", None))
    return note


def broadcast_user_notification(
    users: list,
    *,
    kind: str,
    title: str,
    body: str,
    metadata: dict[str, Any] | None = None,
) -> list[UserNotification]:
    """Create the same notification for many users."""
    created: list[UserNotification] = []
    push_users: list = []
    for user in users or []:
        note = mirror_email_as_user_notification(
            user,
            kind=kind,
            email_subject=title,
            email_body_text=body,
            metadata=metadata,
        )
        if note is not None:
            created.append(note)
            push_users.append(user)
    if push_users:
        try:
            from apps.notifications.tasks import send_pushes_task

            send_pushes_task.delay(
                [u.pk for u in push_users],
                title,
                body,
                metadata or {},
            )
        except Exception:
            logger.warning("broadcast_push_failed", exc_info=True)
    return created


def mirror_email_to_users(
    users: list,
    *,
    kind: str,
    email_subject: str,
    email_body_text: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    for u in users or []:
        try:
            # create in-app notification and attempt push delivery
            mirror_email_as_user_notification_and_push(
                u,
                kind=kind,
                email_subject=email_subject,
                email_body_text=email_body_text,
                metadata=metadata,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("mirror_email_to_users failed user=%s exc=%s", getattr(u, "pk", None), exc)
