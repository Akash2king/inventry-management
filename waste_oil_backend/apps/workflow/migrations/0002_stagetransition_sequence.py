from django.db import migrations, models


def backfill_sequence(apps, schema_editor):
    StageTransition = apps.get_model("workflow", "StageTransition")
    WasteOilRecord = apps.get_model("records", "WasteOilRecord")
    for rid in WasteOilRecord.objects.values_list("pk", flat=True):
        qs = StageTransition.objects.filter(record_id=rid).order_by("timestamp", "id")
        for i, t in enumerate(qs, start=1):
            StageTransition.objects.filter(pk=t.pk).update(sequence=i)


class Migration(migrations.Migration):

    dependencies = [
        ("workflow", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="stagetransition",
            name="sequence",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Monotonic per record — defines true chronological order of transitions.",
            ),
        ),
        migrations.RunPython(backfill_sequence, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name="stagetransition",
            index=models.Index(
                fields=["record", "sequence"],
                name="stage_trans_record_s_2a9c1e_idx",
            ),
        ),
    ]
