from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser, Department


def _paginated_results(data):
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


class GmEmployeeApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.dept1 = Department.objects.create(
            name="D1", code="S1", stage_order=1
        )
        cls.dept2 = Department.objects.create(
            name="D2", code="S2", stage_order=2
        )
        cls.gm_dept = Department.objects.create(
            name="GM Dept", code="GMX", stage_order=5
        )
        cls.gm = CustomUser.objects.create_user(
            username="gm_test",
            email="gm@test.local",
            password="TestPass123",
            role=CustomUser.Role.GM,
            department=cls.gm_dept,
        )
        cls.storeman = CustomUser.objects.create_user(
            username="sm_test",
            email="sm@test.local",
            password="TestPass123",
            role=CustomUser.Role.STOREMAN,
            department=cls.dept1,
        )
        cls.dept3 = Department.objects.create(
            name="D3", code="S3", stage_order=3
        )
        cls.other_gm = CustomUser.objects.create_user(
            username="gm_other",
            email="gm_other@test.local",
            password="TestPass123",
            role=CustomUser.Role.GM,
            department=cls.gm_dept,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.gm)

    def test_storeman_forbidden(self):
        self.client.force_authenticate(user=self.storeman)
        r = self.client.get("/api/v1/gm/departments/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_gm_lists_departments(self):
        r = self.client.get("/api/v1/gm/departments/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        rows = _paginated_results(r.data)
        self.assertGreaterEqual(len(rows), 2)
        stages = {d["stage_order"] for d in rows}
        self.assertNotIn(5, stages, "GM should not receive stage-5 dept for assignments")

    def test_gm_list_excludes_other_gms(self):
        r = self.client.get("/api/v1/gm/employees/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        usernames = {row["username"] for row in _paginated_results(r.data)}
        self.assertIn("sm_test", usernames)
        self.assertNotIn("gm_test", usernames)
        self.assertNotIn("gm_other", usernames)

    def test_create_employee_persisted(self):
        r = self.client.post(
            "/api/v1/gm/employees/",
            {
                "username": "new_sm",
                "email": "new_sm@test.local",
                "full_name": "New Storeman",
                "role": CustomUser.Role.STOREMAN,
                "department": str(self.dept1.id),
                "password": "NewPass1234",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        u = CustomUser.objects.get(username="new_sm")
        self.assertTrue(u.check_password("NewPass1234"))
        self.assertEqual(u.department_id, self.dept1.id)

    def test_create_admin_persisted(self):
        r = self.client.post(
            "/api/v1/gm/employees/",
            {
                "username": "new_admin",
                "email": "new_admin@test.local",
                "full_name": "New Admin",
                "role": CustomUser.Role.ADMIN,
                "department": str(self.dept3.id),
                "password": "NewPass1234",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        u = CustomUser.objects.get(username="new_admin")
        self.assertEqual(u.role, CustomUser.Role.ADMIN)
        self.assertEqual(u.department_id, self.dept3.id)

    def test_gm_cannot_fetch_other_gm_detail(self):
        r = self.client.get(f"/api/v1/gm/employees/{self.other_gm.id}/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)
