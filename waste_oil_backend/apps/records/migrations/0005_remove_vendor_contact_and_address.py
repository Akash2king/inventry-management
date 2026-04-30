from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("records", "0004_record_options_and_extended_record_fields"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="vendor",
            name="contact",
        ),
        migrations.RemoveField(
            model_name="vendor",
            name="address",
        ),
    ]
