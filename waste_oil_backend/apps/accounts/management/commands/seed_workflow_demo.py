"""
Create five departments (stages 1-5) and one demo user per stage for workflow tests.
Run: python manage.py seed_workflow_demo [--password YOUR_PASSWORD]
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import CustomUser, Department

SPECS = [
    (
        "STORE",
        "Stock Entry",
        1,
        Department.WorkflowLayer.PEER,
        "storeman",
        CustomUser.Role.STOREMAN,
    ),
    (
        "TREAT",
        "Treatment Verification",
        2,
        Department.WorkflowLayer.PEER,
        "treatment",
        CustomUser.Role.TREATMENT,
    ),
    (
        "ADMIN",
        "Admin Validation",
        3,
        Department.WorkflowLayer.PEER,
        "waste_admin",
        CustomUser.Role.ADMIN,
    ),
    (
        "MGR",
        "Manager Approval",
        4,
        Department.WorkflowLayer.OVERSIGHT,
        "manager",
        CustomUser.Role.MANAGER,
    ),
    (
        "GM",
        "GM Final Approval",
        5,
        Department.WorkflowLayer.OVERSIGHT,
        "gm",
        CustomUser.Role.GM,
    ),
]


class Command(BaseCommand):
    help = "Seed departments (stages 1-5) and demo workflow users (one per stage)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default="Demo12345",
            help="Password for all demo users (default: Demo12345).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        password = options["password"]

        for code, name, stage_order, workflow_layer, username, role in SPECS:
            dept, created = Department.objects.update_or_create(
                code=code,
                defaults={
                    "name": f"Demo - {name}",
                    "stage_order": stage_order,
                    "workflow_layer": workflow_layer,
                },
            )
            action = "Created" if created else "Updated"
            self.stdout.write(
                f"{action} department {code} (stage {stage_order}, layer {workflow_layer})"
            )

            user, ucreated = CustomUser.objects.update_or_create(
                username=username,
                defaults={
                    "email": f"{username}@demo.local",
                    "role": role,
                    "department": dept,
                    "full_name": f"{username.replace('_', ' ').title()} Demo",
                    "is_active": True,
                    "is_staff": False,
                    "is_superuser": False,
                    "must_change_password": False,
                },
            )
            user.set_password(password)
            user.must_change_password = False
            user.save(update_fields=["password", "must_change_password"])
            uaction = "Created" if ucreated else "Updated"
            self.stdout.write(
                self.style.SUCCESS(
                    f"{uaction} user {username!r} / role={role} / dept={code}"
                )
            )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. All five users share password: {password!r}"
            )
        )
        self.stdout.write("Login: POST /api/v1/auth/login/ with username + password.")
