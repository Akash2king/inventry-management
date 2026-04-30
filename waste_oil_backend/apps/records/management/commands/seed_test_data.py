"""
Django management command to seed demo data for the current workflow model.
Usage:
  python manage.py seed_test_data --clear
  python manage.py seed_test_data --clear --records 40 --password Demo12345
"""

from datetime import timedelta
from decimal import Decimal
from random import choice, randint

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import CustomUser, Department
from apps.records.models import Vendor, WasteOilRecord
from apps.workflow.models import StageTransition

DEPARTMENT_SPECS = [
    {
        "name": "Demo - Stock Entry",
        "code": "STORE",
        "stage_order": 1,
        "workflow_layer": Department.WorkflowLayer.PEER,
    },
    {
        "name": "Demo - Treatment Verification",
        "code": "TREAT",
        "stage_order": 2,
        "workflow_layer": Department.WorkflowLayer.PEER,
    },
    {
        "name": "Demo - Admin Validation",
        "code": "ADMIN",
        "stage_order": 3,
        "workflow_layer": Department.WorkflowLayer.PEER,
    },
    {
        "name": "Demo - Manager Approval",
        "code": "MGR",
        "stage_order": 4,
        "workflow_layer": Department.WorkflowLayer.OVERSIGHT,
    },
    {
        "name": "Demo - GM Final Approval",
        "code": "GM",
        "stage_order": 5,
        "workflow_layer": Department.WorkflowLayer.OVERSIGHT,
    },
]

USER_SPECS = [
    {
        "username": "storeman_demo",
        "email": "storeman_demo@demo.local",
        "full_name": "Storeman Demo",
        "role": CustomUser.Role.STOREMAN,
        "dept_code": "STORE",
    },
    {
        "username": "treatment_demo",
        "email": "treatment_demo@demo.local",
        "full_name": "Treatment Demo",
        "role": CustomUser.Role.TREATMENT,
        "dept_code": "TREAT",
    },
    {
        "username": "waste_admin_demo",
        "email": "waste_admin_demo@demo.local",
        "full_name": "Waste Admin Demo",
        "role": CustomUser.Role.ADMIN,
        "dept_code": "ADMIN",
    },
    {
        "username": "manager_demo",
        "email": "manager_demo@demo.local",
        "full_name": "Manager Demo",
        "role": CustomUser.Role.MANAGER,
        "dept_code": "MGR",
    },
    {
        "username": "gm_demo",
        "email": "gm_demo@demo.local",
        "full_name": "GM Demo",
        "role": CustomUser.Role.GM,
        "dept_code": "GM",
    },
]


class Command(BaseCommand):
    help = "Seed demo departments/users/vendors/records aligned with latest workflow models."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing records/transitions/vendors and demo users/departments before seeding.",
        )
        parser.add_argument(
            "--records",
            type=int,
            default=40,
            help="How many demo records to create (default: 40).",
        )
        parser.add_argument(
            "--password",
            default="Demo12345",
            help="Password for demo users (default: Demo12345).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        record_count = max(5, int(options["records"]))
        password = options["password"]
        if options["clear"]:
            self.clear_data()

        self.stdout.write("\n" + "=" * 54)
        self.stdout.write("WASTE OIL MANAGEMENT - DEMO DATA GENERATOR")
        self.stdout.write("=" * 54 + "\n")

        departments = self.create_departments()
        users = self.create_users(departments, password=password)
        vendors = self.create_vendors()
        records = self.create_waste_oil_records(
            users=users,
            vendors=vendors,
            departments=departments,
            record_count=record_count,
        )
        self.create_stage_transitions(records, departments, users)
        self.print_summary()

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDemo users ready. Shared password: {password!r}\n"
            )
        )

    def clear_data(self):
        self.stdout.write(self.style.WARNING("Clearing existing demo/test data..."))
        StageTransition.objects.all().delete()
        WasteOilRecord.objects.all().delete()
        Vendor.objects.all().delete()
        CustomUser.objects.filter(
            username__in=[s["username"] for s in USER_SPECS]
        ).delete()
        Department.objects.filter(
            code__in=[s["code"] for s in DEPARTMENT_SPECS]
        ).delete()
        self.stdout.write(self.style.SUCCESS("[OK] Cleared demo/test data\n"))

    def create_departments(self):
        self.stdout.write("Creating departments...")
        departments = {}
        for spec in DEPARTMENT_SPECS:
            dept, created = Department.objects.update_or_create(
                code=spec["code"],
                defaults={
                    "name": spec["name"],
                    "stage_order": spec["stage_order"],
                    "workflow_layer": spec["workflow_layer"],
                },
            )
            departments[spec["code"]] = dept
            status = "[OK] Created" if created else "[OK] Updated"
            self.stdout.write(
                f"  {status}: {dept.name} (stage={dept.stage_order}, layer={dept.workflow_layer})"
            )
        self.stdout.write("")
        return departments

    def create_users(self, departments, password):
        self.stdout.write("Creating demo users...")
        users = {}
        for spec in USER_SPECS:
            user, created = CustomUser.objects.update_or_create(
                username=spec["username"],
                defaults={
                    "email": spec["email"],
                    "full_name": spec["full_name"],
                    "role": spec["role"],
                    "department": departments[spec["dept_code"]],
                    "is_active": True,
                    "must_change_password": False,
                },
            )
            user.set_password(password)
            user.must_change_password = False
            user.save(update_fields=["password", "must_change_password"])
            users[spec["username"]] = user
            status = "[OK] Created" if created else "[OK] Updated"
            self.stdout.write(f"  {status}: {user.username} ({user.role})")
        self.stdout.write("")
        return users

    def create_vendors(self):
        self.stdout.write("Creating vendors...")
        vendor_names = [
            "Acme Recycling Ltd",
            "Chem-Solv Industrial Fluids",
            "EcoLube Industries",
            "Premium Oil Recyclers",
            "Green Barrel Traders",
        ]
        vendors = []
        for name in vendor_names:
            vendor, created = Vendor.objects.update_or_create(
                name=name,
                defaults={"notes": "Demo vendor"},
            )
            vendors.append(vendor)
            status = "[OK] Created" if created else "[OK] Updated"
            self.stdout.write(f"  {status}: {vendor.name}")
        self.stdout.write("")
        return vendors

    def _holder_for_stage(self, stage, users):
        if stage == 1:
            return users["storeman_demo"]
        if stage == 2:
            return users["treatment_demo"]
        if stage == 3:
            return users["waste_admin_demo"]
        if stage == 4:
            return users["manager_demo"]
        return users["gm_demo"]

    def create_waste_oil_records(self, users, vendors, departments, record_count):
        self.stdout.write(f"Creating {record_count} waste oil records...")
        product_types = [
            "Hydraulic Oil",
            "Engine Oil",
            "Gear Oil",
            "Turbine Oil",
            "Residual Oil",
        ]
        packaging_opts = ["Drum", "IBC", "Can", "Bulk"]
        units = ["L", "kg", "pcs"]
        now = timezone.now()
        records = []

        for i in range(record_count):
            record_number = f"WO-{2026:04d}-{(i + 1):06d}"
            bucket = i % 5
            stage = bucket + 1
            if bucket == 0:
                alert = WasteOilRecord.AlertLevel.GREEN
            elif bucket == 1:
                alert = WasteOilRecord.AlertLevel.YELLOW
            elif bucket == 2:
                alert = WasteOilRecord.AlertLevel.ORANGE
            elif bucket == 3:
                alert = WasteOilRecord.AlertLevel.RED
            else:
                alert = WasteOilRecord.AlertLevel.COMPLETED

            holder = self._holder_for_stage(stage, users)
            entry_date = (now - timedelta(days=randint(4, 55))).date()
            due_date = entry_date + timedelta(days=randint(7, 24))

            record, created = WasteOilRecord.objects.update_or_create(
                record_number=record_number,
                defaults={
                    "vendor": choice(vendors),
                    "product_description": f"Demo waste oil lot #{i + 1}",
                    "product_type": choice(product_types),
                    "unit": choice(units),
                    "packaging": choice(packaging_opts),
                    "quantity": Decimal(str(round(randint(100, 5000) / 10, 3))),
                    "entry_date": entry_date,
                    "due_date": due_date,
                    "driver_name": f"Driver {i % 8 + 1}",
                    "vehicle_details": f"TN-{10 + i % 89}-{1000 + i}",
                    "current_stage": stage,
                    "alert_level": alert,
                    "current_holder": holder,
                    "current_department": departments[
                        DEPARTMENT_SPECS[stage - 1]["code"]
                    ],
                    "created_by": users["storeman_demo"],
                    "is_locked": alert == WasteOilRecord.AlertLevel.COMPLETED,
                    "remarks": "Auto-generated demo record.",
                },
            )
            records.append(record)
            if (i + 1) % 10 == 0 or i == record_count - 1:
                status = "created/updated"
                self.stdout.write(f"  [OK] {i + 1}/{record_count} records {status}")

        self.stdout.write("")
        return records

    def create_stage_transitions(self, records, departments, users):
        self.stdout.write("Rebuilding stage transitions...")
        StageTransition.objects.filter(record__in=records).delete()
        transition_count = 0

        forward_by_stage = {
            1: users["storeman_demo"],
            2: users["treatment_demo"],
            3: users["waste_admin_demo"],
            4: users["manager_demo"],
        }

        for record in records:
            if record.current_stage <= 1:
                continue
            sequence = 1
            for from_stage in range(1, record.current_stage):
                to_stage = from_stage + 1
                StageTransition.objects.create(
                    record=record,
                    from_stage=from_stage,
                    to_stage=to_stage,
                    from_department=departments[DEPARTMENT_SPECS[from_stage - 1]["code"]],
                    to_department=departments[DEPARTMENT_SPECS[to_stage - 1]["code"]],
                    transitioned_by=forward_by_stage[from_stage],
                    to_holder=self._holder_for_stage(to_stage, users),
                    transition_type=StageTransition.TransitionType.FORWARD,
                    note="Auto-seeded forward transition.",
                    sequence=sequence,
                )
                sequence += 1
                transition_count += 1

        self.stdout.write(f"  [OK] Created {transition_count} transitions\n")

    def print_summary(self):
        self.stdout.write("=" * 54)
        self.stdout.write(self.style.SUCCESS("DEMO DATA SUMMARY"))
        self.stdout.write("=" * 54)
        self.stdout.write(
            f"Departments:  {Department.objects.filter(code__in=[d['code'] for d in DEPARTMENT_SPECS]).count()}"
        )
        self.stdout.write(
            f"Users:        {CustomUser.objects.filter(username__in=[u['username'] for u in USER_SPECS]).count()}"
        )
        self.stdout.write(f"Vendors:      {Vendor.objects.count()}")
        self.stdout.write(f"Records:      {WasteOilRecord.objects.count()}")
        for stage in [1, 2, 3, 4, 5]:
            count = WasteOilRecord.objects.filter(current_stage=stage).count()
            self.stdout.write(f"  - Stage {stage}:  {count}")
        self.stdout.write("\nAlert levels:")
        for level in ["green", "yellow", "orange", "red", "completed"]:
            count = WasteOilRecord.objects.filter(alert_level=level).count()
            self.stdout.write(f"  - {level.upper():10} {count}")
        self.stdout.write(f"\nTransitions: {StageTransition.objects.count()}")
        self.stdout.write("=" * 54)
