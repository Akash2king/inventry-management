from rest_framework import serializers

from apps.accounts.models import CustomUser, Department

ROLE_LAYER = {
    CustomUser.Role.STOREMAN: Department.WorkflowLayer.PEER,
    CustomUser.Role.TREATMENT: Department.WorkflowLayer.PEER,
    CustomUser.Role.ADMIN: Department.WorkflowLayer.PEER,
    CustomUser.Role.MANAGER: Department.WorkflowLayer.OVERSIGHT,
}


class GmDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "name", "code", "stage_order", "workflow_layer")


class GmDepartmentWriteSerializer(serializers.ModelSerializer):
    """Create/update pipeline departments."""

    class Meta:
        model = Department
        fields = ("name", "code", "stage_order", "workflow_layer")
        extra_kwargs = {
            "workflow_layer": {"required": False},
        }

    def validate_stage_order(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError("Stage order must be at least 1.")
        return value

    def validate_workflow_layer(self, value):
        if value not in (
            Department.WorkflowLayer.PEER,
            Department.WorkflowLayer.OVERSIGHT,
        ):
            raise serializers.ValidationError("Invalid workflow layer.")
        return value

    def validate_code(self, value):
        code = (value or "").strip().upper()
        if len(code) < 2:
            raise serializers.ValidationError("Code must be at least 2 characters.")
        return code[:10]

    def validate_name(self, value):
        name = (value or "").strip()
        if len(name) < 2:
            raise serializers.ValidationError("Name must be at least 2 characters.")
        return name[:100]

    def update(self, instance, validated_data):
        # Keep role-stage alignment checks for assigned users unchanged here;
        # changing stage_order might break existing memberships — callers should reconcile.
        return super().update(instance, validated_data)


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
    department_workflow_layer = serializers.CharField(
        source="department.workflow_layer", read_only=True, allow_null=True
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
            "department_workflow_layer",
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
        if value not in ROLE_LAYER:
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
            expected_layer = ROLE_LAYER.get(role)
            if expected_layer is not None and dept.workflow_layer != expected_layer:
                raise serializers.ValidationError(
                    {
                        "department": (
                            f"Department '{dept.code}' is layer '{dept.workflow_layer}'; "
                            f"role '{role}' must use a department in layer '{expected_layer}'."
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
