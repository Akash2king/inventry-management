"""
Pipeline stages: 1–5. dept_code is a logical label; departments in DB are matched by stage_order.
"""

STAGE_MAP = {
    1: {
        "name": "Stock Entry",
        "role": "storeman",
        "dept_code": "STORE",
    },
    2: {
        "name": "Treatment Verification",
        "role": "treatment",
        "dept_code": "TREAT",
    },
    3: {
        "name": "Admin Validation",
        "role": "admin",
        "dept_code": "ADMIN",
    },
    4: {
        "name": "Manager Approval",
        "role": "manager",
        "dept_code": "MGR",
    },
    5: {
        "name": "GM Final Approval",
        "role": "gm",
        "dept_code": "GM",
    },
}

ALERT_LEVEL_ORDER = {
    "red": 0,
    "yellow": 1,
    "green": 2,
    "completed": 3,
}
