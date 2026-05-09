"""Workflow emails mirrored to UserNotification (same copy as inbox; mobile + desktop)."""

from datetime import date
from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser, Department
from apps.notifications.models import UserNotification
from apps.notifications.services import NotificationService
from apps.records.models import Vendor, WasteOilRecord


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    EMAIL_HOST="localhost",
    DEFAULT_FROM_EMAIL="noreply@test.example",
    EMAIL_NOTIFICATIONS_ENABLED=True,
)
class PipelineEmailMirrorsInAppTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.dept = Department.objects.create(
            name="Mirror Dept",
            code="MIR_D",
            stage_order=1,
        )
        cls.vendor = Vendor.objects.create(name="Mirror Vendor", notes="")

    def _record(self, record_number: str, **kwargs):
        data = {
            "record_number": record_number,
            "vendor": self.vendor,
            "product_type": "used",
            "unit": "L",
            "quantity": Decimal("10"),
            "entry_date": date(2026, 1, 10),
            "due_date": date(2026, 2, 10),
            "current_stage": 2,
            "current_department": self.dept,
        }
        data.update(kwargs)
        return WasteOilRecord.objects.create(**data)

    def test_forward_mirrors_same_subject_and_body_to_next_holder(self):
        next_holder = CustomUser.objects.create_user(
            username="mir_next",
            email="mir_next@test.example",
            password="pass12345",
            role=CustomUser.Role.TREATMENT,
            department=self.dept,
        )
        actor = CustomUser.objects.create_user(
            username="mir_actor",
            email="mir_actor@test.example",
            password="pass12345",
            role=CustomUser.Role.STOREMAN,
            department=self.dept,
        )
        record = self._record("INV-MIR-FWD-01")
        NotificationService.send_forwarded_notification(record, next_holder, actor)

        n = UserNotification.objects.get(user=next_holder)
        self.assertEqual(n.kind, UserNotification.Kind.RECORD_FORWARDED)
        self.assertIn(record.record_number, n.title)
        self.assertIn(record.record_number, n.body)
        self.assertIn("forwarded to you", n.title.lower())

    def test_return_mirrors_to_prev_holder(self):
        prev = CustomUser.objects.create_user(
            username="mir_prev",
            email="mir_prev@test.example",
            password="pass12345",
            role=CustomUser.Role.TREATMENT,
            department=self.dept,
        )
        actor = CustomUser.objects.create_user(
            username="mir_ret_actor",
            email="mir_ret_actor@test.example",
            password="pass12345",
            role=CustomUser.Role.ADMIN,
            department=self.dept,
        )
        record = self._record("INV-MIR-RET-01")
        NotificationService.send_return_notification(
            record, prev, "Fix quantity", acting_user=actor
        )

        n = UserNotification.objects.get(user=prev)
        self.assertEqual(n.kind, UserNotification.Kind.RECORD_RETURNED)
        self.assertIn(record.record_number, n.title)
        self.assertIn("Fix quantity", n.body)
        self.assertIn("returned", n.title.lower())

    @override_settings(
        MANAGER_EMAIL="mir_mgr@test.example",
        GM_EMAIL="mir_gm@test.example",
    )
    def test_completion_mirrors_to_users_matching_distribution_emails(self):
        CustomUser.objects.create_user(
            username="mir_mgr_u",
            email="mir_mgr@test.example",
            password="pass12345",
            role=CustomUser.Role.MANAGER,
            department=self.dept,
        )
        CustomUser.objects.create_user(
            username="mir_gm_u",
            email="mir_gm@test.example",
            password="pass12345",
            role=CustomUser.Role.GM,
            department=self.dept,
        )
        actor = CustomUser.objects.create_user(
            username="mir_cmp_actor",
            email="mir_cmp_actor@test.example",
            password="pass12345",
            role=CustomUser.Role.GM,
            department=self.dept,
        )
        record = self._record("INV-MIR-CMP-01")
        NotificationService.send_forwarded_notification(record, None, actor)

        rows = UserNotification.objects.filter(
            kind=UserNotification.Kind.RECORD_COMPLETED
        )
        self.assertEqual(rows.count(), 2)
        for n in rows:
            self.assertIn(record.record_number, n.title)
            self.assertIn(record.record_number, n.body)
            self.assertIn("completed", n.title.lower())


class NotificationListWorkflowOnlyTests(TestCase):
    """Legacy security rows (if any) must not appear in the API list."""

    @classmethod
    def setUpTestData(cls):
        cls.dept = Department.objects.create(name="NList", code="NL", stage_order=1)

    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username="nlist_u",
            email="nlist_u@test.example",
            password="pass12345",
            role=CustomUser.Role.STOREMAN,
            department=self.dept,
        )

    def test_api_hides_legacy_security_kind_rows(self):
        UserNotification.objects.create(
            user=self.user,
            kind="login_new",
            title="Sign-in",
            body="should not list",
        )
        wf = UserNotification.objects.create(
            user=self.user,
            kind=UserNotification.Kind.RECORD_FORWARDED,
            title="Workflow",
            body="ok",
        )
        login = self.client.post(
            "/api/v1/auth/login/",
            {"username": "nlist_u", "password": "pass12345"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access_token']}")
        res = self.client.get("/api/v1/notifications/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = {str(x["id"]) for x in res.data.get("results", [])}
        self.assertIn(str(wf.id), ids)
        self.assertEqual(len(ids), 1)
