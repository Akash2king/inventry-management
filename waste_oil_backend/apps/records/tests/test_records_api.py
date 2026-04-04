import tempfile
from decimal import Decimal
from pathlib import Path

from django.db.models import Max

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser, Department
from apps.audit.models import AuditLog
from apps.records.models import Vendor, WasteOilRecord
from apps.workflow.models import StageTransition


@override_settings(MEDIA_ROOT=str(Path(tempfile.gettempdir()) / "waste_oil_test_media"))
class WasteOilRecordAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.dept1 = Department.objects.create(
            name="StoreMan", code="STM", stage_order=1
        )
        cls.dept2 = Department.objects.create(
            name="Treatment", code="TRT", stage_order=2
        )
        cls.dept3 = Department.objects.create(
            name="Admin", code="ADM", stage_order=3
        )

    def setUp(self):
        self.client = APIClient()
        self.storeman = CustomUser.objects.create_user(
            username="sm",
            email="sm@example.com",
            password="pass12345",
            role=CustomUser.Role.STOREMAN,
            department=self.dept1,
        )
        self.treatment = CustomUser.objects.create_user(
            username="tr",
            email="tr@example.com",
            password="pass12345",
            role=CustomUser.Role.TREATMENT,
            department=self.dept2,
        )
        self.admin_u = CustomUser.objects.create_user(
            username="ad",
            email="ad@example.com",
            password="pass12345",
            role=CustomUser.Role.ADMIN,
            department=self.dept3,
        )
        self.manager = CustomUser.objects.create_user(
            username="mg",
            email="mg@example.com",
            password="pass12345",
            role=CustomUser.Role.MANAGER,
            department=self.dept3,
        )
        self.vendor = Vendor.objects.create(name="Default Vendor", contact="555")

    def _add_transition(self, record_id, **kwargs):
        """Stable per-record ordering (matches WorkflowService) — avoids timestamp/UUID tie issues."""
        m = StageTransition.objects.filter(record_id=record_id).aggregate(
            Max("sequence")
        )
        seq = (m["sequence__max"] or 0) + 1
        return StageTransition.objects.create(
            record_id=record_id, sequence=seq, **kwargs
        )

    def _record_payload(self, **overrides):
        p = {
            "vendor_id": str(self.vendor.id),
            "product_description": "Widget batch",
            "product_type": "General",
            "unit": "kg",
            "quantity": "12.500",
            "entry_date": "2026-03-01",
            "remarks": "note",
        }
        p.update(overrides)
        return p

    def _login(self, user):
        r = self.client.post(
            "/api/v1/auth/login/",
            {"username": user.username, "password": "pass12345"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {r.data['access_token']}"
        )

    def test_storeman_can_create_record(self):
        self._login(self.storeman)
        res = self.client.post(
            "/api/v1/records/", self._record_payload(), format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["record_number"].startswith("WO-2026-"))
        self.assertEqual(res.data["current_stage"], 1)
        self.assertEqual(str(res.data["current_holder_id"]), str(self.storeman.id))
        self.assertEqual(res.data["vendor_name"], "Default Vendor")
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.Action.CREATE, record_id=res.data["id"]
            ).exists()
        )

    def test_non_storeman_cannot_create(self):
        self._login(self.manager)
        res = self.client.post(
            "/api/v1/records/",
            self._record_payload(),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_wrong_department_cannot_edit(self):
        self._login(self.storeman)
        cre = self.client.post(
            "/api/v1/records/", self._record_payload(), format="json"
        )
        rid = cre.data["id"]
        WasteOilRecord.objects.filter(pk=rid).update(
            current_stage=2,
            current_holder=self.storeman,
            current_department=self.dept2,
        )
        patch = self.client.patch(
            f"/api/v1/records/{rid}/",
            {"product_description": "Changed"},
            format="json",
        )
        self.assertEqual(patch.status_code, status.HTTP_403_FORBIDDEN)

    def test_current_holder_can_edit(self):
        v2 = Vendor.objects.create(name="NewNameVendor", contact="x")
        self._login(self.storeman)
        cre = self.client.post(
            "/api/v1/records/", self._record_payload(), format="json"
        )
        rid = cre.data["id"]
        self._login(self.storeman)
        patch = self.client.patch(
            f"/api/v1/records/{rid}/",
            {"vendor_id": str(v2.id)},
            format="json",
        )
        self.assertEqual(patch.status_code, status.HTTP_200_OK)
        self.assertEqual(patch.data["vendor_name"], "NewNameVendor")
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.Action.EDIT, record_id=rid
            ).exists()
        )

    def test_locked_record_edit_rejected(self):
        self._login(self.storeman)
        cre = self.client.post(
            "/api/v1/records/", self._record_payload(), format="json"
        )
        rid = cre.data["id"]
        WasteOilRecord.objects.filter(pk=rid).update(is_locked=True)
        patch = self.client.patch(
            f"/api/v1/records/{rid}/",
            {"product_type": "X"},
            format="json",
        )
        self.assertEqual(patch.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("locked", patch.data["detail"].lower())

    def test_role_based_list_filtering(self):
        v_only = Vendor.objects.create(name="OnlyStoreman", contact="")
        self._login(self.storeman)
        self.client.post(
            "/api/v1/records/",
            self._record_payload(vendor_id=str(v_only.id)),
            format="json",
        )
        v_other = Vendor.objects.create(name="OtherPartyRecord", contact="")
        WasteOilRecord.objects.create(
            record_number="WO-TEST-OTHER-1",
            vendor=v_other,
            product_type="General",
            unit="kg",
            quantity=Decimal("5.000"),
            entry_date="2026-02-01",
            due_date="2026-03-01",
            created_by=self.manager,
            current_holder=self.manager,
            current_department=self.manager.department,
            current_stage=4,
            alert_level=WasteOilRecord.AlertLevel.GREEN,
        )
        self._login(self.manager)
        mgr_list = self.client.get("/api/v1/records/")
        self.assertEqual(mgr_list.status_code, status.HTTP_200_OK)
        vendors = {r["vendor_name"] for r in mgr_list.data["results"]}
        self.assertIn("OnlyStoreman", vendors)
        self.assertIn("OtherPartyRecord", vendors)

        self._login(self.storeman)
        sm_list = self.client.get("/api/v1/records/")
        self.assertEqual(len(sm_list.data["results"]), 2)
        sm_vendors = {r["vendor_name"] for r in sm_list.data["results"]}
        self.assertEqual(sm_vendors, {"OnlyStoreman", "OtherPartyRecord"})

        rec = WasteOilRecord.objects.get(vendor__name="OnlyStoreman")
        WasteOilRecord.objects.filter(pk=rec.pk).update(current_stage=2)
        self._login(self.treatment)
        tr_list = self.client.get("/api/v1/records/")
        self.assertEqual(len(tr_list.data["results"]), 1)

        self._login(self.admin_u)
        ad_list = self.client.get("/api/v1/records/")
        self.assertEqual(len(ad_list.data["results"]), 0)

    def test_detail_shows_return_correction_until_forwarded_again(self):
        v = Vendor.objects.create(name="ReturnedOnce", contact="")
        self._login(self.storeman)
        cre = self.client.post(
            "/api/v1/records/",
            self._record_payload(vendor_id=str(v.id)),
            format="json",
        )
        rid = cre.data["id"]
        WasteOilRecord.objects.filter(pk=rid).update(
            current_stage=2,
            current_holder=self.treatment,
            current_department=self.dept2,
        )
        self._add_transition(
            rid,
            from_stage=1,
            to_stage=2,
            from_department=self.dept1,
            to_department=self.dept2,
            transitioned_by=self.storeman,
            transition_type=StageTransition.TransitionType.FORWARD,
            note="up",
        )
        self._add_transition(
            rid,
            from_stage=2,
            to_stage=1,
            from_department=self.dept2,
            to_department=self.dept1,
            transitioned_by=self.treatment,
            transition_type=StageTransition.TransitionType.RETURN,
            note="fix paperwork",
        )
        WasteOilRecord.objects.filter(pk=rid).update(
            current_stage=1,
            current_holder=self.storeman,
            current_department=self.dept1,
        )
        self._login(self.storeman)
        detail = self.client.get(f"/api/v1/records/{rid}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertTrue(detail.data["needs_workflow_correction"])
        self.assertEqual(detail.data["pending_return_feedback"], "fix paperwork")

        self._add_transition(
            rid,
            from_stage=1,
            to_stage=2,
            from_department=self.dept1,
            to_department=self.dept2,
            transitioned_by=self.storeman,
            transition_type=StageTransition.TransitionType.FORWARD,
            note="resent",
        )
        WasteOilRecord.objects.filter(pk=rid).update(
            current_stage=2,
            current_holder=self.treatment,
            current_department=self.dept2,
        )
        detail2 = self.client.get(f"/api/v1/records/{rid}/")
        self.assertEqual(detail2.status_code, status.HTTP_200_OK)
        self.assertFalse(detail2.data["needs_workflow_correction"])
        self.assertIsNone(detail2.data["pending_return_feedback"])

    def test_treatment_still_sees_record_after_forwarding_via_transition(self):
        v = Vendor.objects.create(name="ForwardedAway", contact="")
        self._login(self.storeman)
        cre = self.client.post(
            "/api/v1/records/",
            self._record_payload(vendor_id=str(v.id)),
            format="json",
        )
        rid = cre.data["id"]
        WasteOilRecord.objects.filter(pk=rid).update(
            current_stage=2,
            current_holder=self.treatment,
            current_department=self.dept2,
        )
        self._add_transition(
            rid,
            from_stage=1,
            to_stage=2,
            from_department=self.dept1,
            to_department=self.dept2,
            transitioned_by=self.treatment,
            transition_type=StageTransition.TransitionType.FORWARD,
            note="picked up",
        )
        WasteOilRecord.objects.filter(pk=rid).update(
            current_stage=3,
            current_holder=self.admin_u,
            current_department=self.dept3,
        )
        self._login(self.treatment)
        detail = self.client.get(f"/api/v1/records/{rid}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["vendor_name"], "ForwardedAway")
        self.assertFalse(detail.data["viewer_is_holder"])
        self.assertEqual(detail.data["current_holder_username"], self.admin_u.username)

    def test_admin_sees_stage_three_even_if_department_stage_mismatched(self):
        mis_admin = CustomUser.objects.create_user(
            username="ad_wrong_dept",
            email="ad_wrong@example.com",
            password="pass12345",
            role=CustomUser.Role.ADMIN,
            department=self.dept1,
        )
        v = Vendor.objects.create(name="AtStage3", contact="")
        self._login(self.storeman)
        cre = self.client.post(
            "/api/v1/records/",
            self._record_payload(vendor_id=str(v.id)),
            format="json",
        )
        rid = cre.data["id"]
        WasteOilRecord.objects.filter(pk=rid).update(
            current_stage=3,
            current_holder=mis_admin,
            current_department=self.dept3,
        )
        self._login(mis_admin)
        detail = self.client.get(f"/api/v1/records/{rid}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["vendor_name"], "AtStage3")

    def test_attachment_requires_holder(self):
        self._login(self.storeman)
        cre = self.client.post(
            "/api/v1/records/", self._record_payload(), format="json"
        )
        rid = cre.data["id"]
        f = SimpleUploadedFile("a.txt", b"hello", content_type="text/plain")
        res = self.client.post(
            f"/api/v1/records/{rid}/attachments/",
            {"file": f},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        rec = WasteOilRecord.objects.get(pk=rid)
        self.assertEqual(len(rec.attachment_paths), 1)

    def test_api_health_no_auth(self):
        c = APIClient()
        r = c.get("/api/v1/health/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "ok")
        self.assertEqual(r.data["version"], "1.0.0")
        self.assertIn("timestamp", r.data)
