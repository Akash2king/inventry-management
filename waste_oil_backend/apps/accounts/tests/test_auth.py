from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.permissions import (
    IsAdminDept,
    IsCurrentHolder,
    IsGM,
    IsManager,
    IsManagerOrAbove,
    IsStoreman,
    IsTreatment,
)
from apps.accounts.models import CustomUser, Department, UserAuthSession
from apps.audit.models import AuditLog
from apps.records.models import Vendor, WasteOilRecord

User = get_user_model()


class AuthEndpointTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.dept = Department.objects.create(
            name="StoreMan",
            code="STM",
            stage_order=1,
        )

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="auth_user",
            email="auth_user@example.com",
            password="secret123",
            full_name="Auth User",
            role=CustomUser.Role.STOREMAN,
            department=self.dept,
        )

    def test_login_returns_tokens_and_user_and_role_in_access_payload(self):
        res = self.client.post(
            "/api/v1/auth/login/",
            {"username": "auth_user", "password": "secret123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", res.data)
        self.assertIn("refresh_token", res.data)
        self.assertIn("user", res.data)
        self.assertEqual(res.data["user"]["role"], CustomUser.Role.STOREMAN)
        self.assertEqual(str(res.data["user"]["department_id"]), str(self.dept.id))
        self.assertIn("session", res.data)
        self.assertEqual(res.data["session"]["client_kind"], "unknown")
        self.assertTrue(UserAuthSession.objects.filter(user=self.user).exists())

        access = AccessToken(res.data["access_token"])
        self.assertEqual(access["role"], CustomUser.Role.STOREMAN)
        self.assertEqual(access["department_id"], str(self.dept.id))

        self.assertTrue(
            AuditLog.objects.filter(
                user=self.user, action=AuditLog.Action.LOGIN
            ).exists()
        )

    def test_login_wrong_password_returns_401(self):
        res = self.client.post(
            "/api/v1/auth/login/",
            {"username": "auth_user", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_returns_access_token(self):
        login = self.client.post(
            "/api/v1/auth/login/",
            {"username": "auth_user", "password": "secret123"},
            format="json",
        )
        refresh_token = login.data["refresh_token"]
        res = self.client.post(
            "/api/v1/auth/refresh/",
            {"refresh_token": refresh_token},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", res.data)
        self.assertIn("refresh_token", res.data)

    def test_logout_blacklists_refresh_subsequent_refresh_401(self):
        login = self.client.post(
            "/api/v1/auth/login/",
            {"username": "auth_user", "password": "secret123"},
            format="json",
        )
        refresh_token = login.data["refresh_token"]
        out = self.client.post(
            "/api/v1/auth/logout/",
            {"refresh_token": refresh_token},
            format="json",
        )
        self.assertEqual(out.status_code, status.HTTP_200_OK)

        again = self.client.post(
            "/api/v1/auth/refresh/",
            {"refresh_token": refresh_token},
            format="json",
        )
        self.assertEqual(again.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_auth_and_returns_profile(self):
        me_anon = self.client.get("/api/v1/auth/me/")
        self.assertEqual(me_anon.status_code, status.HTTP_401_UNAUTHORIZED)

        login = self.client.post(
            "/api/v1/auth/login/",
            {"username": "auth_user", "password": "secret123"},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login.data['access_token']}"
        )
        me = self.client.get("/api/v1/auth/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data["role"], CustomUser.Role.STOREMAN)
        self.assertNotIn("password", me.data)


class PermissionClassTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.dept = Department.objects.create(
            name="Dept",
            code="D1",
            stage_order=1,
        )

    def _user(self, role):
        return User.objects.create_user(
            username=f"u_{role}",
            email=f"{role}@example.com",
            password="x",
            role=role,
            department=self.dept,
        )

    def _request(self, user):
        factory = APIRequestFactory()
        request = factory.get("/dummy/")
        request.user = user
        return request

    def test_is_storeman(self):
        perm = IsStoreman()
        self.assertTrue(perm.has_permission(self._request(self._user(CustomUser.Role.STOREMAN)), None))
        self.assertFalse(perm.has_permission(self._request(self._user(CustomUser.Role.MANAGER)), None))

    def test_is_treatment(self):
        perm = IsTreatment()
        self.assertTrue(perm.has_permission(self._request(self._user(CustomUser.Role.TREATMENT)), None))
        self.assertFalse(perm.has_permission(self._request(self._user(CustomUser.Role.STOREMAN)), None))

    def test_is_admin_dept(self):
        perm = IsAdminDept()
        self.assertTrue(perm.has_permission(self._request(self._user(CustomUser.Role.ADMIN)), None))
        self.assertFalse(perm.has_permission(self._request(self._user(CustomUser.Role.GM)), None))

    def test_is_manager(self):
        perm = IsManager()
        self.assertTrue(perm.has_permission(self._request(self._user(CustomUser.Role.MANAGER)), None))
        self.assertFalse(perm.has_permission(self._request(self._user(CustomUser.Role.GM)), None))

    def test_is_gm(self):
        perm = IsGM()
        self.assertTrue(perm.has_permission(self._request(self._user(CustomUser.Role.GM)), None))
        self.assertFalse(perm.has_permission(self._request(self._user(CustomUser.Role.MANAGER)), None))

    def test_is_manager_or_above(self):
        perm = IsManagerOrAbove()
        self.assertTrue(perm.has_permission(self._request(self._user(CustomUser.Role.MANAGER)), None))
        self.assertTrue(perm.has_permission(self._request(self._user(CustomUser.Role.GM)), None))
        self.assertTrue(perm.has_permission(self._request(self._user(CustomUser.Role.SUPERADMIN)), None))
        self.assertFalse(perm.has_permission(self._request(self._user(CustomUser.Role.ADMIN)), None))

    def test_is_current_holder(self):
        holder = self._user(CustomUser.Role.STOREMAN)
        other = self._user(CustomUser.Role.MANAGER)
        v = Vendor.objects.create(name="V")
        record = WasteOilRecord.objects.create(
            record_number="WO-2026-000099",
            vendor=v,
            product_type="used",
            unit="ea",
            quantity=10,
            entry_date="2026-01-01",
            due_date="2026-02-01",
            current_holder=holder,
        )
        perm = IsCurrentHolder()
        self.assertTrue(
            perm.has_object_permission(self._request(holder), None, record)
        )
        self.assertFalse(
            perm.has_object_permission(self._request(other), None, record)
        )
