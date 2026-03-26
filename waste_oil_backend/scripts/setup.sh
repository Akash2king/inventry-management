#!/bin/bash
# Quick setup script for development testing

echo "=================================================="
echo "Waste Oil Management - Quick Setup"
echo "=================================================="
echo ""

# Check if venv is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  Virtual environment not activated. Please run:"
    echo "   source .venv/bin/activate"
    exit 1
fi

echo "Step 1: Running migrations..."
python manage.py migrate
echo "✓ Migrations completed"
echo ""

echo "Step 2: Seeding test data..."
python scripts/seed_test_data.py
echo ""

echo "Step 3: Creating superuser (optional)..."
echo "Run manually if needed:"
echo "   python manage.py createsuperuser"
echo ""

echo "=================================================="
echo "✅ Setup complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "  1. Start the server: python manage.py runserver 0.0.0.0:8000"
echo "  2. Access admin: http://localhost:8000/admin"
echo "  3. Mock users available (password: testpass123)"
echo ""
