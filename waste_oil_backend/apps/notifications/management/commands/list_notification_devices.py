from django.core.management.base import BaseCommand
from apps.notifications.models import NotificationDevice


class Command(BaseCommand):
    help = "List registered notification devices"

    def handle(self, *args, **options):
        qs = NotificationDevice.objects.select_related("user").order_by("-last_seen_at")
        self.stdout.write("id\tuser\tplatform\ttoken\tlast_seen")
        for d in qs:
            self.stdout.write(f"{d.id}\t{d.user.username}\t{d.platform}\t{d.token[:32]}...\t{d.last_seen_at}")
