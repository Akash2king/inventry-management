"""
Workflow API: forward, return, queue, transitions.
"""
from datetime import date
from pathlib import Path
import tempfile

from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser, Department
from apps.audit.models import AuditLog
from apps.records.models import Vendor, WasteOilRecord
from apps.workflow.models import StageTransition


@override_settings(
    MEDIA_ROOT=str(Path(tempfile.gettempdir()) / "waste_oil_test_media"),
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
)
class WorkflowAPITests(TestCase):
    """Five-stage pipeline: departments STORE..GM aligned with constants.STAGE_MAP."""

    @classmethod
    def setUpTestData(cls):
        cls.dept_s1 = Department.objects.create(
            name="Workflow Stock Entry",
            code="WF_S1",
            stage_order=1,
        )
        cls.dept_s2 = Department.objects.create(
            name="Workflow Treatment",
            code="WF_S2",
            stage_order=2,
        )
        cls.dept_s3 = Department.objects.create(
            name="Workflow Admin",
            code="WF_S3",
            stage_order=3,
        )
        cls.dept_s4 = Department.objects.create(
            name="Workflow Manager",
            code="WF_S4",
            stage_order=4,
        )
        cls.dept_s5 = Department.objects.create(
            name="Workflow GM",
            code="WF_S5",
            stage_order=5,
        )

    def setUp(self):
        self.client = APIClient()
        # date_joined order: first created user per stage wins as next_holder
        self.storeman = CustomUser.objects.create_user(
            username="wf_sm",
            email="wf_sm@example.com",
            password="pass12345",
            role=CustomUser.Role.STOREMAN,
            department=self.dept_s1,
        )
        self.treatment = CustomUser.objects.create_user(
            username="wf_tr",
            email="wf_tr@example.com",
            password="pass12345",
            role=CustomUser.Role.TREATMENT,
            department=self.dept_s2,
        )
        self.admin_u = CustomUser.objects.create_user(
            username="wf_ad",
            email="wf_ad@example.com",
            password="pass12345",
            role=CustomUser.Role.ADMIN,
            department=self.dept_s3,
        )
        self.manager = CustomUser.objects.create_user(
            username="wf_mg",
            email="wf_mg@example.com",
            password="pass12345",
            role=CustomUser.Role.MANAGER,
            department=self.dept_s4,
        )
        self.gm = CustomUser.objects.create_user(
            username="wf_gm",
            email="wf_gm@example.com",
            password="pass12345",
            role=CustomUser.Role.GM,
            department=self.dept_s5,
        )
        self.superadmin = CustomUser.objects.create_user(
            username="wf_sa",
            email="wf_sa@example.com",
            password="pass12345",
            role=CustomUser.Role.SUPERADMIN,
            department=self.dept_s5,
        )

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

    def _create_record(self, *, vendor="Vendor A", coll_date="2026-01-10"):
        self._login(self.storeman)
        v, _ = Vendor.objects.get_or_create(
            name=vendor,
            defaults={"contact": "", "address": "", "notes": ""},
        )
        res = self.client.post(
            "/api/v1/records/",
            {
                "vendor_id": str(v.id),
                "product_description": "",
                "product_type": "used",
                "unit": "L",
                "quantity": "100.000",
                "entry_date": coll_date,
                "remarks": "",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        rid = res.data["id"]
        self.client.credentials()
        return str(rid)

    def _forward(self, user, record_id, note="", *, next_holder_id=None):
        self._login(user)
        body = {"note": note}
        if next_holder_id is not None:
            body["next_holder_id"] = str(next_holder_id)
        return self.client.post(
            f"/api/v1/records/{record_id}/forward/",
            body,
            format="json",
        )

    def _return(self, user, record_id, reason):
        self._login(user)
        return self.client.post(
            f"/api/v1/records/{record_id}/return/",
            {"reason": reason},
            format="json",
        )

    def test_forward_from_stage_1(self):
        rid = self._create_record()
        res = self._forward(self.storeman, rid, note="ok")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rec = WasteOilRecord.objects.get(pk=rid)
        self.assertEqual(rec.current_stage, 2)
        self.assertEqual(rec.current_holder_id, self.treatment.id)
        self.assertEqual(rec.current_department_id, self.dept_s2.id)
        tr = StageTransition.objects.filter(record_id=rid)
        self.assertEqual(tr.count(), 1)
        t = tr.first()
        self.assertEqual(t.from_stage, 1)
        self.assertEqual(t.to_stage, 2)
        self.assertEqual(t.transition_type, StageTransition.TransitionType.FORWARD)
        self.assertEqual(t.transitioned_by_id, self.storeman.id)
        self.assertEqual(t.note, "ok")

    def test_forward_candidates_stage_1(self):
        rid = self._create_record()
        self._login(self.storeman)
        res = self.client.get(f"/api/v1/records/{rid}/forward-candidates/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = {str(row["id"]) for row in res.data}
        self.assertIn(str(self.treatment.id), ids)

    def test_forward_candidates_empty_at_stage_5(self):
        rid = self._create_record()
        self._forward(self.storeman, rid)
        self._forward(self.treatment, rid)
        self._forward(self.admin_u, rid)
        self._forward(self.manager, rid)
        self.client.credentials()
        self._login(self.gm)
        res = self.client.get(f"/api/v1/records/{rid}/forward-candidates/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_forward_with_chosen_next_holder(self):
        treatment_b = CustomUser.objects.create_user(
            username="wf_tr2",
            email="wf_tr2@example.com",
            password="pass12345",
            role=CustomUser.Role.TREATMENT,
            department=self.dept_s2,
        )
        rid = self._create_record()
        self.client.credentials()
        res = self._forward(
            self.storeman, rid, note="pick b", next_holder_id=treatment_b.id
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rec = WasteOilRecord.objects.get(pk=rid)
        self.assertEqual(rec.current_holder_id, treatment_b.id)
        self.assertNotEqual(rec.current_holder_id, self.treatment.id)

    def test_forward_rejects_next_holder_wrong_stage(self):
        rid = self._create_record()
        self.client.credentials()
        res = self._forward(
            self.storeman, rid, next_holder_id=self.admin_u.id
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_forward_from_stage_2(self):
        rid = self._create_record()
        self._forward(self.storeman, rid)
        self.client.credentials()
        res = self._forward(self.treatment, rid)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rec = WasteOilRecord.objects.get(pk=rid)
        self.assertEqual(rec.current_stage, 3)
        self.assertEqual(rec.current_holder_id, self.admin_u.id)

    def test_forward_from_stage_3(self):
        rid = self._create_record()
        self._forward(self.storeman, rid)
        self._forward(self.treatment, rid)
        self.client.credentials()
        res = self._forward(self.admin_u, rid)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rec = WasteOilRecord.objects.get(pk=rid)
        self.assertEqual(rec.current_stage, 4)
        self.assertEqual(rec.current_holder_id, self.manager.id)

    def test_forward_from_stage_4(self):
        rid = self._create_record()
        self._forward(self.storeman, rid)
        self._forward(self.treatment, rid)
        self._forward(self.admin_u, rid)
        self.client.credentials()
        res = self._forward(self.manager, rid)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rec = WasteOilRecord.objects.get(pk=rid)
        self.assertEqual(rec.current_stage, 5)
        self.assertEqual(rec.current_holder_id, self.gm.id)

    def test_forward_from_stage_5_completes(self):
        rid = self._create_record()
        self._forward(self.storeman, rid)
        self._forward(self.treatment, rid)
        self._forward(self.admin_u, rid)
        self._forward(self.manager, rid)
        self.client.credentials()
        res = self._forward(self.gm, rid, note="final ok")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rec = WasteOilRecord.objects.get(pk=rid)
        self.assertTrue(rec.is_locked)
        self.assertEqual(rec.alert_level, WasteOilRecord.AlertLevel.COMPLETED)
        self.assertTrue(
            AuditLog.objects.filter(
                record_id=rid, action=AuditLog.Action.APPROVE
            ).exists()
        )

    def test_forward_wrong_stage_rejected(self):
        """Holder's department stage_order must match record.current_stage."""
        rid = self._create_record()
        self._forward(self.storeman, rid)
        rec = WasteOilRecord.objects.get(pk=rid)
        # Superadmin can see any record; holder mismatching stage triggers service check
        rec.current_holder = self.superadmin
        rec.save(update_fields=["current_holder"])
        self.client.credentials()
        res = self._forward(self.superadmin, rid)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_forward_not_current_holder_rejected(self):
        rid = self._create_record()
        self.client.credentials()
        # Manager sees all records but is not the current holder
        res = self._forward(self.manager, rid)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_forward_locked_record_rejected(self):
        rid = self._create_record()
        WasteOilRecord.objects.filter(pk=rid).update(is_locked=True)
        self.client.credentials()
        res = self._forward(self.storeman, rid)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_return_empty_reason_rejected(self):
        rid = self._create_record()
        self._forward(self.storeman, rid)
        self.client.credentials()
        self._login(self.treatment)
        res = self.client.post(
            f"/api/v1/records/{rid}/return/",
            {"reason": "   "},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", res.data)

    def test_return_missing_reason_rejected(self):
        rid = self._create_record()
        self._forward(self.storeman, rid)
        self.client.credentials()
        self._login(self.treatment)
        res = self.client.post(
            f"/api/v1/records/{rid}/return/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_return_from_stage_1_rejected(self):
        rid = self._create_record()
        self.client.credentials()
        res = self._return(self.storeman, rid, reason="nope")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_workflow_queue_includes_return_correction_fields(self):
        rid = self._create_record()
        self._forward(self.storeman, rid)
        self._return(self.treatment, rid, reason="correct the quantity")
        self.client.credentials()
        self._login(self.storeman)
        res = self.client.get("/api/v1/workflow/queue/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        row = next(r for r in res.data if str(r["id"]) == str(rid))
        self.assertTrue(row["needs_workflow_correction"])
        self.assertEqual(row["pending_return_feedback"], "correct the quantity")

    def test_return_to_previous_holder(self):
        rid = self._create_record()
        self._forward(self.storeman, rid, note="to treatment")
        self.client.credentials()
        res = self._return(self.treatment, rid, reason="incomplete paperwork")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rec = WasteOilRecord.objects.get(pk=rid)
        self.assertEqual(rec.current_stage, 1)
        self.assertEqual(rec.current_holder_id, self.storeman.id)
        self.assertEqual(rec.current_department_id, self.dept_s1.id)
        ret = StageTransition.objects.filter(
            record_id=rid, transition_type=StageTransition.TransitionType.RETURN
        ).first()
        self.assertIsNotNone(ret)
        self.assertEqual(ret.from_stage, 2)
        self.assertEqual(ret.to_stage, 1)
        self.assertEqual(ret.note, "incomplete paperwork")
        self.assertTrue(
            AuditLog.objects.filter(
                record_id=rid, action=AuditLog.Action.RETURN
            ).exists()
        )

    def test_full_five_stage_cycle_transitions_and_audit(self):
        rid = self._create_record()
        self._forward(self.storeman, rid, note="n1")
        self._forward(self.treatment, rid, note="n2")
        self._forward(self.admin_u, rid, note="n3")
        self._forward(self.manager, rid, note="n4")
        self._forward(self.gm, rid, note="n5")

        transitions = list(
            StageTransition.objects.filter(record_id=rid).order_by("timestamp")
        )
        self.assertEqual(len(transitions), 5)
        expected = [
            (1, 2, StageTransition.TransitionType.FORWARD, "n1"),
            (2, 3, StageTransition.TransitionType.FORWARD, "n2"),
            (3, 4, StageTransition.TransitionType.FORWARD, "n3"),
            (4, 5, StageTransition.TransitionType.FORWARD, "n4"),
            (5, 5, StageTransition.TransitionType.FORWARD, "n5"),
        ]
        for t, (fs, ts, tt, note) in zip(transitions, expected, strict=True):
            self.assertEqual(t.from_stage, fs)
            self.assertEqual(t.to_stage, ts)
            self.assertEqual(t.transition_type, tt)
            self.assertEqual(t.note, note)

        forward_logs = AuditLog.objects.filter(
            record_id=rid, action=AuditLog.Action.FORWARD
        ).count()
        approve_logs = AuditLog.objects.filter(
            record_id=rid, action=AuditLog.Action.APPROVE
        ).count()
        self.assertEqual(forward_logs, 4)
        self.assertEqual(approve_logs, 1)

    def test_transitions_endpoint_ordered_asc(self):
        rid = self._create_record()
        self._forward(self.storeman, rid)
        self._return(self.treatment, rid, reason="back")
        self._forward(self.storeman, rid, note="again")
        self.client.credentials()
        self._login(self.treatment)
        res = self.client.get(f"/api/v1/records/{rid}/transitions/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        types = [row["transition_type"] for row in res.data]
        self.assertEqual(types, ["forward", "return", "forward"])
        stages = [(row["from_stage"], row["to_stage"]) for row in res.data]
        self.assertEqual(stages, [(1, 2), (2, 1), (1, 2)])

    def test_queue_sorted_alert_then_collection_date(self):
        # Two records at stage 2, visible to treatment
        rid_a = self._create_record(vendor="A", coll_date="2026-03-01")
        rid_b = self._create_record(vendor="B", coll_date="2026-01-01")
        WasteOilRecord.objects.filter(pk=rid_a).update(
            current_stage=2,
            current_holder=self.treatment,
            current_department=self.dept_s2,
            alert_level=WasteOilRecord.AlertLevel.RED,
        )
        WasteOilRecord.objects.filter(pk=rid_b).update(
            current_stage=2,
            current_holder=self.treatment,
            current_department=self.dept_s2,
            alert_level=WasteOilRecord.AlertLevel.GREEN,
        )
        self.client.credentials()
        self._login(self.treatment)
        res = self.client.get("/api/v1/workflow/queue/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        vendors = [row["vendor_name"] for row in res.data]
        self.assertEqual(vendors, ["A", "B"])

        # Same alert: older entry_date (more days elapsed) first
        WasteOilRecord.objects.filter(pk=rid_a).update(
            alert_level=WasteOilRecord.AlertLevel.GREEN,
            entry_date=date(2026, 3, 1),
        )
        WasteOilRecord.objects.filter(pk=rid_b).update(
            alert_level=WasteOilRecord.AlertLevel.GREEN,
            entry_date=date(2026, 1, 1),
        )
        self.client.credentials()
        self._login(self.treatment)
        res = self.client.get("/api/v1/workflow/queue/")
        vendors = [row["vendor_name"] for row in res.data]
        self.assertEqual(vendors, ["B", "A"])

    def test_queue_excludes_locked(self):
        rid = self._create_record()
        self._forward(self.storeman, rid)
        rec = WasteOilRecord.objects.get(pk=rid)
        rec.is_locked = True
        rec.save(update_fields=["is_locked"])
        self.client.credentials()
        self._login(self.treatment)
        res = self.client.get("/api/v1/workflow/queue/")
        ids = [str(row["id"]) for row in res.data]
        self.assertNotIn(rid, ids)
