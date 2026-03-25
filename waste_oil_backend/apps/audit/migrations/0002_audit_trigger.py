"""
PostgreSQL only: immutable audit_log via BEFORE UPDATE / DELETE trigger.
Skipped on other databases (e.g. SQLite dev).
"""

from django.db import migrations


FORWARD_STATEMENTS = [
    """
    CREATE OR REPLACE FUNCTION prevent_audit_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
        RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP
            USING ERRCODE = 'integrity_constraint_violation';
    END;
    $$ LANGUAGE plpgsql
    """,
    "DROP TRIGGER IF EXISTS trg_audit_log_prevent_update ON audit_log",
    "DROP TRIGGER IF EXISTS trg_audit_log_prevent_delete ON audit_log",
    """
    CREATE TRIGGER trg_audit_log_prevent_update
        BEFORE UPDATE ON audit_log
        FOR EACH ROW
        EXECUTE PROCEDURE prevent_audit_mutation()
    """,
    """
    CREATE TRIGGER trg_audit_log_prevent_delete
        BEFORE DELETE ON audit_log
        FOR EACH ROW
        EXECUTE PROCEDURE prevent_audit_mutation()
    """,
]

REVERSE_STATEMENTS = [
    "DROP TRIGGER IF EXISTS trg_audit_log_prevent_update ON audit_log",
    "DROP TRIGGER IF EXISTS trg_audit_log_prevent_delete ON audit_log",
    "DROP FUNCTION IF EXISTS prevent_audit_mutation()",
]


def _run_sql(schema_editor, statements):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        for sql in statements:
            cursor.execute(sql.strip())


def apply_trigger(apps, schema_editor):
    _run_sql(schema_editor, FORWARD_STATEMENTS)


def remove_trigger(apps, schema_editor):
    _run_sql(schema_editor, REVERSE_STATEMENTS)


class Migration(migrations.Migration):
    dependencies = [
        ("audit", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(apply_trigger, remove_trigger),
    ]
