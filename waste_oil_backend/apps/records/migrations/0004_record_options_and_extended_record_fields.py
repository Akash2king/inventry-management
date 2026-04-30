import uuid

from django.db import migrations, models


def seed_record_options(apps, schema_editor):
    RecordOption = apps.get_model("records", "RecordOption")
    defaults = {
        "product_type": ["Waste Oil", "Chemical", "Solvent", "Other"],
        "unit": ["L", "kg", "pcs"],
        "driver_name": [],
        "packaging": ["IBC", "Drum", "Carboy", "Isotank", "Others"],
    }
    for category, values in defaults.items():
        for value in values:
            RecordOption.objects.get_or_create(category=category, value=value)


class Migration(migrations.Migration):
    dependencies = [
        ("records", "0003_rename_waste_oil_r_entry_d_7b8f1e_idx_waste_oil_r_entry_d_4f7714_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="wasteoilrecord",
            name="driver_name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="packaging",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="photo_path",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="time_in",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="time_out",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="vehicle_details",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
        migrations.CreateModel(
            name="RecordOption",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("category", models.CharField(choices=[("product_type", "Product Type"), ("unit", "Unit"), ("driver_name", "Driver Name"), ("packaging", "Packaging")], max_length=40)),
                ("value", models.CharField(max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "record_options",
                "ordering": ["category", "value", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="recordoption",
            constraint=models.UniqueConstraint(
                fields=("category", "value"), name="uq_record_option_category_value"
            ),
        ),
        migrations.RunPython(seed_record_options, migrations.RunPython.noop),
    ]
