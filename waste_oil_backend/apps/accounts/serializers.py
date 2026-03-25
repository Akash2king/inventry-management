from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer

from .models import CustomUser


class UserProfileSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(
        source="department.name",
        read_only=True,
        allow_null=True,
    )
    department_stage_order = serializers.IntegerField(
        source="department.stage_order",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = CustomUser
        fields = (
            "id",
            "username",
            "full_name",
            "role",
            "department_id",
            "department_name",
            "department_stage_order",
        )
        read_only_fields = fields


class WasteOilTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds role and department_id to JWT claims; extends response with user profile."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["department_id"] = (
            str(user.department_id) if user.department_id is not None else None
        )
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserProfileSerializer(self.user).data
        return data


class WasteOilTokenRefreshSerializer(TokenRefreshSerializer):
    """Accepts refresh_token in request body (alias of SimpleJWT's refresh)."""

    refresh = serializers.CharField(required=False, allow_null=True, write_only=True)
    refresh_token = serializers.CharField(write_only=True)

    def validate(self, attrs):
        attrs = dict(attrs)
        token = attrs.pop("refresh_token", None) or attrs.pop("refresh", None)
        if not token:
            raise serializers.ValidationError({"refresh_token": "This field is required."})
        attrs["refresh"] = token
        return super().validate(attrs)
