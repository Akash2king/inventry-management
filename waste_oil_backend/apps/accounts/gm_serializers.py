from rest_framework import serializers

from apps.accounts.models import CustomUser, Department

ROLE_STAGE = {
    CustomUser.Role.STOREMAN: 1,
    CustomUser.Role.TREATMENT: 2,
    CustomUser.Role.ADMIN: 3,
    CustomUser.Role.MANAGER: 4,
}


class GmDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "name", "code", "stage_order")


class GmEmployeeReadSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(
        source="department.name", read_only=True, allow_null=True
    )
    department_code = serializers.CharField(
        source="department.code", read_only=True, allow_null=True
    )
    department_stage_order = serializers.IntegerField(
        source="department.stage_order", read_only=True, allow_null=True
    )

    class Meta:
        model = CustomUser
        fields = (
            "id",
            "username",
            "email",
            "full_name",
            "role",
            "department",
            "department_name",
            "department_code",
            "department_stage_order",
            "is_active",
            "must_change_password",
            "date_joined",
        )
        read_only_fields = fields


class GmEmployeeWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        required=False,
        help_text="Required on create; optional on update (leave blank to keep).",
    )

    class Meta:
        model = CustomUser
        fields = (
            "username",
            "email",
            "full_name",
            "role",
            "department",
            "is_active",
            "password",
        )
        extra_kwargs = {
            "username": {"required": True},
            "email": {"required": True},
            "department": {"required": True},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            self.fields["username"].read_only = True
            self.fields["department"].required = False
            self.fields["email"].required = False
            self.fields["role"].required = False

    def validate_role(self, value):
        if value in (CustomUser.Role.GM, CustomUser.Role.SUPERADMIN):
            raise serializers.ValidationError(
                "GM and Superadmin accounts cannot be created from this console."
            )
        if value not in ROLE_STAGE:
            raise serializers.ValidationError("Invalid role for pipeline employee.")
        return value

    def validate(self, attrs):
        pwd = (attrs.get("password") or "").strip()
        if not self.instance and not pwd:
            raise serializers.ValidationError(
                {"password": "This field is required when creating a user."}
            )
        instance = getattr(self, "instance", None)
        role = attrs.get("role", getattr(instance, "role", None) if instance else None)
        dept = attrs.get("department", getattr(instance, "department", None) if instance else None)
        if role and dept:
            expected = ROLE_STAGE.get(role)
            if expected is not None and dept.stage_order != expected:
                raise serializers.ValidationError(
                    {
                        "department": (
                            f"Department '{dept.code}' is stage {dept.stage_order}; "
                            f"role '{role}' must use a department at stage {expected}."
                        )
                    }
                )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.must_change_password = True
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        if password is not None and not str(password).strip():
            password = None
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
            instance.must_change_password = True
        instance.save()
        return instance
