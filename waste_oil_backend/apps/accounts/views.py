from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.audit.models import AuditLog

from .models import UserAuthSession
from .serializers import (
    ChangePasswordSerializer,
    UserAuthSessionSerializer,
    UserProfileSerializer,
    WasteOilTokenObtainPairSerializer,
    WasteOilTokenRefreshSerializer,
)
from .session_service import (
    create_session_on_login,
    revoke_session_by_id_for_user,
    revoke_session_by_refresh_token,
    sync_session_jti_after_refresh,
)


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = WasteOilTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        payload = dict(request.data)
        device_context = payload.pop("device_context", None)
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        data = serializer.validated_data

        session = create_session_on_login(
            user=user,
            refresh_token_str=data["refresh"],
            request=request,
            device_context=device_context if isinstance(device_context, dict) else None,
        )

        AuditLog.objects.create(
            user=user,
            action=AuditLog.Action.LOGIN,
            description="User authenticated.",
        )

        session_payload = UserAuthSessionSerializer(
            session,
            context={"current_session_id": str(session.id)},
        ).data

        body = {
            "access_token": data["access"],
            "refresh_token": data["refresh"],
            "user": data["user"],
            "session": session_payload,
        }
        return Response(body, status=status.HTTP_200_OK)


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_raw = request.data.get("refresh_token") or request.data.get("refresh")
        if not refresh_raw:
            return Response(
                {"detail": "refresh_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = WasteOilTokenRefreshSerializer(data={"refresh_token": refresh_raw})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except ValidationError as exc:
            return Response(
                exc.detail if hasattr(exc, "detail") else {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        validated = serializer.validated_data
        out = {"access_token": validated["access"]}
        if "refresh" in validated:
            out["refresh_token"] = validated["refresh"]
            sync_session_jti_after_refresh(
                old_refresh_str=refresh_raw,
                new_refresh_str=validated["refresh"],
            )
        return Response(out, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_raw = request.data.get("refresh_token")
        if not refresh_raw:
            return Response(
                {"detail": "refresh_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_raw)
            user_id = token.payload.get("user_id")
        except TokenError:
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        revoke_session_by_refresh_token(
            refresh_token_str=refresh_raw,
            user_id=user_id,
        )

        if user_id:
            AuditLog.objects.create(
                user_id=user_id,
                action=AuditLog.Action.LOGOUT,
                description="User session ended (refresh token blacklisted).",
            )

        return Response({"detail": "Logged out."}, status=status.HTTP_200_OK)


class AuthSessionListView(generics.ListAPIView):
    """List sign-ins for the current user (active by default)."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserAuthSessionSerializer

    def get_queryset(self):
        qs = UserAuthSession.objects.filter(user=self.request.user)
        active = self.request.query_params.get("active", "1")
        if str(active).lower() in ("1", "true", "yes", ""):
            qs = qs.filter(revoked_at__isnull=True)
        return qs.order_by("-last_seen_at")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        sid = self.request.META.get("HTTP_X_SESSION_ID")
        if sid:
            ctx["current_session_id"] = str(sid)
        return ctx


class AuthSessionRevokeView(APIView):
    """End another device session (blacklists that refresh token)."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, *args, **kwargs):
        current = request.META.get("HTTP_X_SESSION_ID")
        if current and str(pk) == str(current):
            return Response(
                {
                    "detail": "Use POST /api/v1/auth/logout/ with this device's refresh_token "
                    "to end the current session."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            session = UserAuthSession.objects.get(
                id=pk,
                user=request.user,
                revoked_at__isnull=True,
            )
        except UserAuthSession.DoesNotExist:
            return Response(
                {"detail": "Session not found or already ended."},
                status=status.HTTP_404_NOT_FOUND,
            )

        revoke_session_by_id_for_user(session_id=session.id, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return Response(UserProfileSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        request.user.refresh_from_db()
        return Response(UserProfileSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    return Response({"app": "accounts", "status": "ok"})
