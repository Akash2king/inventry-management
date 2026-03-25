# Pipeline departments (stages 1–5). Matches codes used by seed_workflow_demo.

from django.db import migrations


def seed_pipeline_departments(apps, schema_editor):
    Department = apps.get_model("accounts", "Department")
    rows = [
        ("STORE", "Stock Entry", 1),
        ("TREAT", "Treatment Verification", 2),
        ("ADMIN", "Admin Validation", 3),
        ("MGR", "Manager Approval", 4),
        ("GM", "GM Final Approval", 5),
    ]
    for code, name, stage_order in rows:
        Department.objects.update_or_create(
            code=code,
            defaults={"name": name, "stage_order": stage_order},
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_pipeline_departments, noop),
    ]
