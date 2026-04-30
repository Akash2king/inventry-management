import os
import re
import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.core.files.storage import default_storage
from django.db import connection, transaction
from django.utils import timezone

from apps.accounts.models import CustomUser
from apps.admin_console.models import SystemConfig
from apps.audit.models import AuditLog
from apps.audit.services import AuditService
from apps.records.models import Vendor, WasteOilRecord


class RecordIDGenerator:
    """
    Generates WO-{YYYY}-{NNNNNN} under an atomic transaction.

    PostgreSQL: locks the latest matching row with FOR UPDATE SKIP LOCKED; if no row
    is returned (none match or all skipped), falls back to a blocking SELECT … FOR UPDATE
    so sequence generation remains correct under concurrency.
    """

    _PATTERN = re.compile(r"^WO-(\d{4})-(\d{6})$")

    @classmethod
    def generate(cls) -> str:
        year = timezone.now().year
        prefix = f"WO-{year}-"

        with transaction.atomic():
            last_num = cls._locked_latest_sequence(year, prefix)
            next_seq = (last_num or 0) + 1
            return f"{prefix}{next_seq:06d}"

    @classmethod
    def _locked_latest_sequence(cls, year: int, prefix: str) -> int | None:
        if connection.vendor == "postgresql":
            return cls._postgres_latest_sequence(prefix)
        return cls._orm_latest_sequence(prefix)

    @classmethod
    def _postgres_latest_sequence(cls, prefix: str) -> int | None:
        like = prefix + "%"
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT record_number FROM waste_oil_records
                WHERE record_number LIKE %s
                ORDER BY record_number DESC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
                """,
                [like],
            )
            row = cursor.fetchone()

            if row is None and WasteOilRecord.objects.filter(
                record_number__startswith=prefix
            ).exists():
                cursor.execute(
                    """
                    SELECT record_number FROM waste_oil_records
                    WHERE record_number LIKE %s
                    ORDER BY record_number DESC
                    LIMIT 1
                    FOR UPDATE
                    """,
                    [like],
                )
                row = cursor.fetchone()

        if not row:
            return None
        return cls._parse_suffix(row[0])

    @classmethod
    def _orm_latest_sequence(cls, prefix: str) -> int | None:
        qs = (
            WasteOilRecord.objects.filter(record_number__startswith=prefix)
            .order_by("-record_number")
            .select_for_update()
        )
        last = qs.first()
        if not last:
            return None
        return cls._parse_suffix(last.record_number)

    @staticmethod
    def _parse_suffix(record_number: str) -> int | None:
        m = RecordIDGenerator._PATTERN.match(record_number)
        if not m:
            return None
        return int(m.group(2))


class EditControlService:
    @staticmethod
    def can_edit(user, record: WasteOilRecord) -> bool:
        if record.is_locked:
            return False
        dept = getattr(user, "department", None)
        if dept is None:
            return False
        return dept.stage_order == record.current_stage


class RecordService:
    @staticmethod
    def create(user, validated_data: dict, request=None) -> WasteOilRecord:
        if user.role != CustomUser.Role.STOREMAN:
            raise PermissionDenied("Only storeman users can create records.")

        record_number = RecordIDGenerator.generate()
        vendor: Vendor = validated_data["vendor"]
        entry_date = validated_data["entry_date"]
        sla_days = SystemConfig.get_value(
            "SLA_DAYS",
            default=getattr(settings, "SLA_DAYS", 30),
            cast=int,
        )
        if sla_days is None:
            sla_days = getattr(settings, "SLA_DAYS", 30)

        due_date = validated_data.get("due_date")
        if due_date is None:
            due_date = entry_date + timedelta(days=int(sla_days))

        if user.department_id is None:
            raise PermissionDenied(
                "Storeman must have a department assigned to create records."
            )

        record = WasteOilRecord.objects.create(
            record_number=record_number,
            vendor=vendor,
            product_description=validated_data.get("product_description") or "",
            product_type=validated_data["product_type"],
            unit=validated_data["unit"],
            packaging=validated_data.get("packaging") or "",
            quantity=validated_data["quantity"],
            entry_date=entry_date,
            due_date=due_date,
            driver_name=validated_data.get("driver_name") or "",
            vehicle_details=validated_data.get("vehicle_details") or "",
            remarks=validated_data.get("remarks") or "",
            current_stage=1,
            current_holder=user,
            current_department=user.department,
            created_by=user,
        )

        AuditService.log(
            user,
            AuditLog.Action.CREATE,
            record,
            description=f"Created record {record_number}.",
            request=request,
        )
        return record

    @staticmethod
    def snapshot_for_audit(record: WasteOilRecord) -> dict:
        return {
            "vendor_id": str(record.vendor_id),
            "product_description": record.product_description,
            "product_type": record.product_type,
            "unit": record.unit,
            "packaging": record.packaging,
            "quantity": str(record.quantity),
            "entry_date": record.entry_date.isoformat(),
            "due_date": record.due_date.isoformat(),
            "driver_name": record.driver_name,
            "vehicle_details": record.vehicle_details,
            "photo_path": record.photo_path,
            "remarks": record.remarks,
            "attachment_paths": list(record.attachment_paths or []),
        }

    @staticmethod
    def apply_patch(
        user, record: WasteOilRecord, validated_data: dict, request=None
    ) -> WasteOilRecord:
        if record.is_locked:
            raise PermissionDenied(
                "Record is locked. No further edits permitted."
            )
        if not EditControlService.can_edit(user, record):
            raise PermissionDenied(
                "Your department does not match the record's current stage."
            )

        previous = RecordService.snapshot_for_audit(record)
        changed = {}

        for field in (
            "vendor",
            "product_description",
            "product_type",
            "unit",
            "packaging",
            "quantity",
            "entry_date",
            "due_date",
            "driver_name",
            "vehicle_details",
            "remarks",
        ):
            if field not in validated_data:
                continue
            new_val = validated_data[field]
            if field == "quantity" and new_val is not None:
                new_val = Decimal(str(new_val))
            old = getattr(record, field)
            if field == "quantity":
                old_cmp = str(old)
                new_cmp = str(new_val)
            elif field in ("entry_date", "due_date"):
                old_cmp = old.isoformat() if old else None
                new_cmp = new_val.isoformat() if new_val else None
            elif field == "vendor":
                old_cmp = str(old.pk) if old else None
                new_cmp = str(new_val.pk) if new_val else None
            else:
                old_cmp = old
                new_cmp = new_val
            if old_cmp != new_cmp:
                changed[field] = new_val

        for field, value in validated_data.items():
            setattr(record, field, value)
        record.save()

        if changed:
            safe_new = {}
            for k, v in changed.items():
                if isinstance(v, Decimal):
                    safe_new[k] = str(v)
                elif hasattr(v, "isoformat"):
                    safe_new[k] = v.isoformat()
                elif k == "vendor" and v is not None:
                    safe_new[k] = str(v.pk)
                else:
                    safe_new[k] = v
            AuditService.log(
                user,
                AuditLog.Action.EDIT,
                record,
                description="Record updated.",
                previous_data=previous,
                new_data=safe_new,
                request=request,
            )
        return record

    @staticmethod
    def save_attachment(
        record: WasteOilRecord, uploaded_file, user, request=None
    ) -> str:
        if record.is_locked:
            raise PermissionDenied(
                "Record is locked. No further edits permitted."
            )

        safe_name = os.path.basename(uploaded_file.name)
        subdir = f"records/{record.pk}"
        path = f"{subdir}/{uuid.uuid4().hex}_{safe_name}"

        saved_path = default_storage.save(path, uploaded_file)
        paths = list(record.attachment_paths or [])
        paths.append(saved_path)
        record.attachment_paths = paths
        record.save(update_fields=["attachment_paths", "updated_at"])

        AuditService.log(
            user,
            AuditLog.Action.EDIT,
            record,
            description=f"Attachment added: {saved_path}",
            new_data={"attachment_added": saved_path},
            request=request,
        )
        return saved_path

    @staticmethod
    def save_photo(record: WasteOilRecord, uploaded_file, user, request=None) -> str:
        if record.is_locked:
            raise PermissionDenied(
                "Record is locked. No further edits permitted."
            )
        safe_name = os.path.basename(uploaded_file.name)
        subdir = f"records/{record.pk}/photos"
        path = f"{subdir}/{uuid.uuid4().hex}_{safe_name}"
        saved_path = default_storage.save(path, uploaded_file)
        record.photo_path = saved_path
        record.save(update_fields=["photo_path", "updated_at"])
        AuditService.log(
            user,
            AuditLog.Action.EDIT,
            record,
            description=f"Photo uploaded: {saved_path}",
            new_data={"photo_path": saved_path},
            request=request,
        )
        return saved_path
