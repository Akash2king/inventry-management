"""
Convenience wrapper for seeding backend demo data.

Usage:
  cd waste_oil_backend
  python scripts/seed_test_data.py
  python scripts/seed_test_data.py --records 60 --password Demo12345
"""

import os
import sys

import django
from django.core.management import call_command

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
django.setup()


def _parse_args(argv):
    records = 40
    password = "Demo12345"
    for idx, item in enumerate(argv):
        if item == "--records" and idx + 1 < len(argv):
            try:
                records = int(argv[idx + 1])
            except ValueError:
                pass
        if item == "--password" and idx + 1 < len(argv):
            password = argv[idx + 1]
    return records, password


def main():
    records, password = _parse_args(sys.argv[1:])
    call_command(
        "seed_test_data",
        clear=True,
        records=records,
        password=password,
    )


if __name__ == "__main__":
    main()
