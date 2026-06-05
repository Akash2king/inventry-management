from django.db import migrations, models


def seed_department_layers(apps, schema_editor):
    Department = apps.get_model("accounts", "Department")
    # Existing data model uses stage_order; map to cluster tiers.
    # stage 1..3 => peer cluster, stage >=4 => oversight cluster
    Department.objects.filter(stage_order__gte=4).update(workflow_layer="oversight")
    Department.objects.filter(stage_order__lt=4).update(workflow_layer="peer")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_must_change_password"),
    ]

    operations = [
        migrations.AddField(
            model_name="department",
            name="workflow_layer",
            field=models.CharField(
                choices=[("peer", "Peer"), ("oversight", "Oversight")],
                default="peer",
                max_length=20,
            ),
        ),
        migrations.RunPython(seed_department_layers, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name="department",
            index=models.Index(fields=["workflow_layer"], name="departments_workflo_7986f9_idx"),
        ),
    ]
