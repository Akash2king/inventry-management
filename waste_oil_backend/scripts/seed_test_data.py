"""
Test Data Generation Script for Waste Oil Management System
This script populates the database with realistic test data.

Usage:
    cd waste_oil_backend
    python scripts/seed_test_data.py
"""

import os
import sys
import django

# Add parent directory to path so we can import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from decimal import Decimal
from random import choice, randint

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
django.setup()

from django.utils import timezone
from apps.accounts.models import Department, CustomUser
from apps.records.models import Vendor, WasteOilRecord
from apps.workflow.models import StageTransition


def clear_data():
    """Clear existing test data (optional)"""
    print("Clearing existing data...")
    WasteOilRecord.objects.all().delete()
    StageTransition.objects.all().delete()
    Vendor.objects.all().delete()
    CustomUser.objects.filter(username__startswith="user_").delete()
    Department.objects.all().delete()
    print("✓ Data cleared\n")


def create_departments():
    """Create workflow departments/stages"""
    print("Creating departments...")
    departments_data = [
        {"name": "Intake", "code": "INT", "stage_order": 1},
        {"name": "Treatment", "code": "TRT", "stage_order": 2},
        {"name": "Analysis", "code": "ANA", "stage_order": 3},
        {"name": "Approval", "code": "APR", "stage_order": 4},
        {"name": "Storage", "code": "STO", "stage_order": 5},
    ]
    
    departments = []
    for dept_data in departments_data:
        dept, created = Department.objects.get_or_create(
            code=dept_data["code"],
            defaults={
                "name": dept_data["name"],
                "stage_order": dept_data["stage_order"],
            }
        )
        departments.append(dept)
        status = "✓ Created" if created else "→ Exists"
        print(f"  {status}: {dept.name}")
    
    print()
    return departments


def create_users(departments):
    """Create test users with different roles"""
    print("Creating users...")
    
    users_data = [
        {"username": "user_storeman1", "email": "storeman1@test.com", "role": "storeman", "dept_idx": 0},
        {"username": "user_storeman2", "email": "storeman2@test.com", "role": "storeman", "dept_idx": 0},
        {"username": "user_treatment1", "email": "treatment1@test.com", "role": "treatment", "dept_idx": 1},
        {"username": "user_treatment2", "email": "treatment2@test.com", "role": "treatment", "dept_idx": 1},
        {"username": "user_analyst1", "email": "analyst1@test.com", "role": "manager", "dept_idx": 2},
        {"username": "user_approver1", "email": "approver1@test.com", "role": "manager", "dept_idx": 3},
        {"username": "user_admin", "email": "admin@test.com", "role": "admin", "dept_idx": None},
        {"username": "user_gm", "email": "gm@test.com", "role": "gm", "dept_idx": None},
    ]
    
    users = []
    for user_data in users_data:
        user, created = CustomUser.objects.get_or_create(
            username=user_data["username"],
            defaults={
                "email": user_data["email"],
                "role": user_data["role"],
                "full_name": user_data["username"].replace("_", " ").title(),
                "department": departments[user_data["dept_idx"]] if user_data["dept_idx"] is not None else None,
            }
        )
        if created:
            user.set_password("testpass123")
            user.save()
        users.append(user)
        status = "✓ Created" if created else "→ Exists"
        print(f"  {status}: {user.username} ({user.role})")
    
    print()
    return users


def create_vendors():
    """Create test vendors"""
    print("Creating vendors...")
    
    vendors_data = [
        {"name": "Green Oil Suppliers Ltd", "contact": "+1-555-0101", "address": "123 Oil St, City"},
        {"name": "EcoLube Industries", "contact": "+1-555-0102", "address": "456 Clean Ave, Town"},
        {"name": "Waste Management Corp", "contact": "+1-555-0103", "address": "789 Recycle Rd, Metro"},
        {"name": "Industrial Fluids Inc", "contact": "+1-555-0104", "address": "321 Factory Ln, District"},
        {"name": "Premium Oil Recyclers", "contact": "+1-555-0105", "address": "654 Plant Way, Region"},
    ]
    
    vendors = []
    for vendor_data in vendors_data:
        vendor, created = Vendor.objects.get_or_create(
            name=vendor_data["name"],
            defaults={
                "contact": vendor_data["contact"],
                "address": vendor_data["address"],
            }
        )
        vendors.append(vendor)
        status = "✓ Created" if created else "→ Exists"
        print(f"  {status}: {vendor.name}")
    
    print()
    return vendors


def create_waste_oil_records(users, vendors, departments):
    """Create test waste oil records with various stages and alert levels"""
    print("Creating waste oil records...")
    
    alert_levels = ["green", "yellow", "red", "completed"]
    product_types = ["Hydraulic Oil", "Engine Oil", "Gear Oil", "Turbine Oil", "Residual Oil"]
    units = ["Liters", "Gallons", "Barrels", "Cubic Meters"]
    
    records = []
    base_date = timezone.now()
    
    for i in range(50):
        record_number = f"WOR-{2024001 + i}"
        
        # Determine stage and alert level based on index
        if i < 10:
            current_stage = 1
            alert_level = "green"
        elif i < 20:
            current_stage = 2
            alert_level = choice(["green", "yellow"])
        elif i < 30:
            current_stage = 3
            alert_level = choice(["yellow", "red"])
        elif i < 40:
            current_stage = 4
            alert_level = "yellow"
        else:
            current_stage = 5
            alert_level = "completed"
        
        # Create record
        record, created = WasteOilRecord.objects.get_or_create(
            record_number=record_number,
            defaults={
                "vendor": choice(vendors),
                "product_description": f"Test waste oil sample {i+1} for processing",
                "product_type": choice(product_types),
                "unit": choice(units),
                "quantity": Decimal(str(round(randint(100, 10000) / 10, 2))),
                "entry_date": (base_date - timedelta(days=randint(0, 60))).date(),
                "due_date": (base_date + timedelta(days=randint(1, 30))).date(),
                "current_stage": current_stage,
                "alert_level": alert_level,
                "current_holder": choice(users),
                "current_department": departments[current_stage - 1],
                "created_by": choice(users),
                "is_locked": alert_level == "completed",
            }
        )
        
        if created:
            records.append(record)
            status = "✓ Created"
        else:
            status = "→ Exists"
        
        print(f"  {status}: {record_number} - Stage {current_stage} ({alert_level})")
    
    print()
    return records


def create_stage_transitions(records, departments):
    """Create stage transitions for records"""
    print("Creating stage transitions...")
    
    transition_count = 0
    
    for record in records:
        if record.current_stage > 1:
            # Create transitions for stages the record passed through
            for stage in range(1, record.current_stage):
                transition, created = StageTransition.objects.get_or_create(
                    record=record,
                    from_stage=stage,
                    to_stage=stage + 1,
                    defaults={
                        "from_department": departments[stage - 1] if stage > 0 else None,
                        "to_department": departments[stage] if stage < len(departments) else None,
                        "transition_type": "forward",
                        "transitioned_by": record.created_by,
                    }
                )
                if created:
                    transition_count += 1
    
    print(f"  ✓ Created {transition_count} stage transitions\n")


def print_summary():
    """Print data summary"""
    print("=" * 50)
    print("TEST DATA SUMMARY")
    print("=" * 50)
    print(f"Departments:      {Department.objects.count()}")
    print(f"Users:            {CustomUser.objects.filter(username__startswith='user_').count()}")
    print(f"Vendors:          {Vendor.objects.count()}")
    print(f"Records:          {WasteOilRecord.objects.count()}")
    print(f"  - Stage 1:      {WasteOilRecord.objects.filter(current_stage=1).count()}")
    print(f"  - Stage 2:      {WasteOilRecord.objects.filter(current_stage=2).count()}")
    print(f"  - Stage 3:      {WasteOilRecord.objects.filter(current_stage=3).count()}")
    print(f"  - Stage 4:      {WasteOilRecord.objects.filter(current_stage=4).count()}")
    print(f"  - Stage 5:      {WasteOilRecord.objects.filter(current_stage=5).count()}")
    print(f"\nAlert Levels:")
    for level in ["green", "yellow", "red", "completed"]:
        count = WasteOilRecord.objects.filter(alert_level=level).count()
        print(f"  - {level.upper():12} {count}")
    print(f"\nTransitions:      {StageTransition.objects.count()}")
    print("=" * 50)
    print("\n✅ Test data generation complete!\n")


def main():
    """Main execution"""
    print("\n" + "=" * 50)
    print("WASTE OIL MANAGEMENT - TEST DATA GENERATOR")
    print("=" * 50 + "\n")
    
    try:
        # Uncomment the line below to clear existing data before seeding
        # clear_data()
        
        departments = create_departments()
        users = create_users(departments)
        vendors = create_vendors()
        records = create_waste_oil_records(users, vendors, departments)
        create_stage_transitions(records, departments)
        
        print_summary()
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
