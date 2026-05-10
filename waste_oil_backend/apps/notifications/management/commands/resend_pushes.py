from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from apps.notifications.tasks import send_pushes_task


class Command(BaseCommand):
    help = "Enqueue push resend to a user or all users. Use --username or --all"

    def add_arguments(self, parser):
        parser.add_argument("--username", help="username to target")
        parser.add_argument("--all", action="store_true", help="send to all users with devices")
        parser.add_argument("--title", default="Notification", help="push title")
        parser.add_argument("--body", default="Test push", help="push body")

    def handle(self, *args, **options):
        User = get_user_model()
        username = options.get("username")
        send_all = options.get("all")
        title = options.get("title")
        body = options.get("body")

        if not send_all and not username:
            raise CommandError("Provide --username or --all")

        if send_all:
            user_ids = list(User.objects.filter(devices__isnull=False).distinct().values_list("id", flat=True))
        else:
            try:
                u = User.objects.get(username=username)
            except User.DoesNotExist:
                raise CommandError(f"User not found: {username}")
            user_ids = [u.id]

        if not user_ids:
            self.stdout.write("No target users found")
            return

        send_pushes_task.delay(user_ids, title, body, {})
        self.stdout.write(f"Enqueued push for {len(user_ids)} user(s)")
