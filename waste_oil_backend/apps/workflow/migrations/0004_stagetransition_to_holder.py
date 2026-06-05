from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("workflow", "0003_alter_stagetransition_options_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="stagetransition",
            name="to_holder",
            field=models.ForeignKey(
                blank=True,
                db_column="to_holder_id",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="stage_transitions_received",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]

