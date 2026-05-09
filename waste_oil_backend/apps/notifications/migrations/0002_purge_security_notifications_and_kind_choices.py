# Manual migration: remove session/sign-in notification rows; align kind choices with workflow-only model.

from django.db import migrations, models

_SECURITY_KINDS = ("login_new", "logout", "session_revoked_remote")


def purge_security_notifications(apps, schema_editor):
    UserNotification = apps.get_model("notifications", "UserNotification")
    UserNotification.objects.filter(kind__in=_SECURITY_KINDS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0001_user_auth_session_and_notifications"),
    ]

    operations = [
        migrations.RunPython(purge_security_notifications, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="usernotification",
            name="kind",
            field=models.CharField(
                max_length=40,
                choices=[
                    ("record_forwarded", "Record forwarded"),
                    ("record_returned", "Record returned"),
                    ("record_completed", "Record completed"),
                    ("sla_alert", "SLA alert"),
                    ("monthly_report", "Monthly report"),
                    ("welcome_employee", "Welcome"),
                ],
            ),
        ),
    ]
