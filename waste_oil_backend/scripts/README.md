# Test Data & Scripts

This directory contains utility scripts for development and testing.

## seed_test_data.py

Comprehensive test data generation script for the Waste Oil Management System.

### What it creates:

- **5 Departments**: Intake, Treatment, Analysis, Approval, Storage
- **8 Users**: Storemen, treatment staff, analysts, approvers, admins (different roles)
- **5 Vendors**: Various waste oil suppliers
- **50 Waste Oil Records**: With mixed stages (1-5) and alert levels
- **Stage Transitions**: Tracking record movement through workflow

### Distribution:

- **Records by Stage:**
  - Stage 1 (Intake): 10 records
  - Stage 2 (Treatment): 10 records
  - Stage 3 (Analysis): 10 records
  - Stage 4 (Approval): 10 records
  - Stage 5 (Completed): 10 records

- **Alert Levels:**
  - Green: Early records
  - Yellow: Mid-stage records
  - Red: Later-stage records
  - Completed: Final stage records

### Usage

**Method 1: Direct Python execution**
```bash
cd waste_oil_backend
python scripts/seed_test_data.py
```

**Method 2: Django shell**
```bash
cd waste_oil_backend
python manage.py shell
>>> exec(open('scripts/seed_test_data.py').read())
```

**Method 3: Custom Django command (optional)**
```bash
python manage.py seed_test_data
```

### Default Test Credentials

After running the script, you can login with any user:

```
username: user_storeman1
password: testpass123

username: user_admin
password: testpass123

username: user_gm
password: testpass123
```

### Configuration

To **clear existing data** before seeding, uncomment this line in the script:
```python
clear_data()  # Uncomment to reset everything
```

### What the script does:

1. ✓ Creates all necessary departments
2. ✓ Creates users with different roles and department assignments
3. ✓ Creates vendors for record sourcing
4. ✓ Creates 50 records with realistic data distribution
5. ✓ Creates stage transitions tracking record movement
6. ✓ Prints comprehensive summary

### Notes:

- **Idempotent**: Safe to run multiple times (won't duplicate data)
- **Django Setup**: Automatically initializes Django environment
- **No External Dependencies**: Uses only Django ORM
- **Activity Distributed**: Records spread across 60 days of entry dates
- **Random Assignments**: Users/vendors randomly assigned to records

### Example Output:

```
==================================================
WASTE OIL MANAGEMENT - TEST DATA GENERATOR
==================================================

Creating departments...
  ✓ Created: Intake
  ✓ Created: Treatment
  ...

Creating users...
  ✓ Created: user_storeman1 (storeman)
  ✓ Created: user_admin (admin)
  ...

Creating waste oil records...
  ✓ Created: WOR-2024001 - Stage 1 (green)
  ✓ Created: WOR-2024002 - Stage 2 (yellow)
  ...

==================================================
TEST DATA SUMMARY
==================================================
Departments:      5
Users:            8
Vendors:          5
Records:          50
  - Stage 1:      10
  - Stage 2:      10
  ...

✅ Test data generation complete!
```

## Extending the Script

To add more test data:

1. Add a new function like `create_your_data()`
2. Call it from `main()`
3. Update `print_summary()` to show your data counts

Example:
```python
def create_alerts():
    """Create test alerts"""
    # Your code here
    print("✓ Created X alerts")

def main():
    # ... existing code ...
    create_alerts()  # Add this
    print_summary()
```
