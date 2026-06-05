from django.contrib.auth import get_user_model

from apps.audit.models import AuditLog
from apps.records.models import WasteOilRecord


def _client_ip(request):
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class AuditService:
    @staticmethod
    def log(
        user,
        action,
        record=None,
        *,
        description="",
        previous_data=None,
        new_data=None,
        request=None,
    ):
        User = get_user_model()
        uid = user.pk if isinstance(user, User) else user

        return AuditLog.objects.create(
            user_id=uid,
            action=action,
            record=record if isinstance(record, WasteOilRecord) else None,
            description=description or "",
            previous_data=previous_data,
            new_data=new_data,
            ip_address=_client_ip(request),
        )
