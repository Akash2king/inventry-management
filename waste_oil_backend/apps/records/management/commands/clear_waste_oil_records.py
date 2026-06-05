"""
Remove every waste oil record so you can start fresh.

Deletes cascade to stage_transitions and alert_notifications.
Audit log rows stay; their record_id is set to NULL (SET_NULL).

Usage:
  python manage.py clear_waste_oil_records --yes
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.records.models import WasteOilRecord


class Command(BaseCommand):
    help = "Delete all WasteOilRecord rows (and related workflow/alert rows)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Confirm destructive delete (required).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not options["yes"]:
            self.stderr.write(
                self.style.ERROR(
                    "Aborted. Re-run with --yes to delete all records.\n"
                    "  python manage.py clear_waste_oil_records --yes"
                )
            )
            return

        n = WasteOilRecord.objects.count()
        WasteOilRecord.objects.all().delete()
        self.stdout.write(
            self.style.SUCCESS(f"Deleted {n} waste oil record(s). New numbers start from the next WO-* sequence.")
        )
