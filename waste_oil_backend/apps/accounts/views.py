from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.audit.models import AuditLog

from .serializers import (
    ChangePasswordSerializer,
    UserProfileSerializer,
    WasteOilTokenObtainPairSerializer,
    WasteOilTokenRefreshSerializer,
)


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = WasteOilTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        data = serializer.validated_data

        AuditLog.objects.create(
            user=user,
            action=AuditLog.Action.LOGIN,
            description="User authenticated.",
        )

        body = {
            "access_token": data["access"],
            "refresh_token": data["refresh"],
            "user": data["user"],
        }
        return Response(body, status=status.HTTP_200_OK)


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]
    serializer_class = WasteOilTokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK and "access" in response.data:
            response.data = {"access_token": response.data["access"]}
        return response


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
            token.blacklist()
        except TokenError:
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user_id:
            AuditLog.objects.create(
                user_id=user_id,
                action=AuditLog.Action.LOGOUT,
                description="User session ended (refresh token blacklisted).",
            )

        return Response({"detail": "Logged out."}, status=status.HTTP_200_OK)


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
