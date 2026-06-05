# Manual migration: Vendor master + inventory-style record fields (replaces oil-specific columns).

import uuid

import django.db.models.deletion
from django.db import migrations, models


def migrate_record_fields(apps, schema_editor):
    Vendor = apps.get_model("records", "Vendor")
    WasteOilRecord = apps.get_model("records", "WasteOilRecord")
    for r in WasteOilRecord.objects.all():
        name = (getattr(r, "vendor_name", None) or "Unknown").strip()[:200]
        contact_raw = getattr(r, "vendor_contact", None) or ""
        contact = str(contact_raw).strip()[:200]
        v, _ = Vendor.objects.get_or_create(
            name=name or "Unknown",
            defaults={"contact": contact, "address": "", "notes": ""},
        )
        r.vendor_id = v.id
        r.product_description = ""
        r.product_type = (getattr(r, "oil_type", None) or "General")[:120]
        r.unit = "L"
        r.quantity = getattr(r, "quantity_litres", 0)
        r.entry_date = getattr(r, "collection_date", None)
        r.due_date = getattr(r, "disposal_deadline", None)
        r.save()


class Migration(migrations.Migration):

    dependencies = [
        ("records", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Vendor",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("name", models.CharField(max_length=200)),
                ("contact", models.CharField(blank=True, max_length=200)),
                ("address", models.TextField(blank=True)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "vendors",
                "ordering": ["name", "id"],
            },
        ),
        migrations.RemoveIndex(
            model_name="wasteoilrecord",
            name="waste_oil_r_collect_1f80c0_idx",
        ),
        migrations.RemoveIndex(
            model_name="wasteoilrecord",
            name="waste_oil_r_disposa_92fbb6_idx",
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="vendor",
            field=models.ForeignKey(
                db_column="vendor_id",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="records",
                to="records.vendor",
            ),
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="product_description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="product_type",
            field=models.CharField(default="", max_length=120),
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="unit",
            field=models.CharField(default="", max_length=40),
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="quantity",
            field=models.DecimalField(
                decimal_places=3, max_digits=12, null=True
            ),
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="entry_date",
            field=models.DateField(null=True),
        ),
        migrations.AddField(
            model_name="wasteoilrecord",
            name="due_date",
            field=models.DateField(null=True),
        ),
        migrations.RunPython(migrate_record_fields, migrations.RunPython.noop),
        migrations.RemoveField(model_name="wasteoilrecord", name="vendor_name"),
        migrations.RemoveField(model_name="wasteoilrecord", name="vendor_contact"),
        migrations.RemoveField(model_name="wasteoilrecord", name="quantity_litres"),
        migrations.RemoveField(model_name="wasteoilrecord", name="oil_type"),
        migrations.RemoveField(model_name="wasteoilrecord", name="collection_date"),
        migrations.RemoveField(model_name="wasteoilrecord", name="disposal_deadline"),
        migrations.AlterField(
            model_name="wasteoilrecord",
            name="vendor",
            field=models.ForeignKey(
                db_column="vendor_id",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="records",
                to="records.vendor",
            ),
        ),
        migrations.AlterField(
            model_name="wasteoilrecord",
            name="quantity",
            field=models.DecimalField(decimal_places=3, max_digits=12),
        ),
        migrations.AlterField(
            model_name="wasteoilrecord",
            name="entry_date",
            field=models.DateField(),
        ),
        migrations.AlterField(
            model_name="wasteoilrecord",
            name="due_date",
            field=models.DateField(),
        ),
        migrations.AddIndex(
            model_name="wasteoilrecord",
            index=models.Index(
                fields=["entry_date"], name="waste_oil_r_entry_d_7b8f1e_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="wasteoilrecord",
            index=models.Index(
                fields=["due_date"], name="waste_oil_r_due_dat_9c2a4b_idx"
            ),
        ),
    ]
