from datetime import date

from django.db import migrations


def align_2026_2027_calendar(apps, _schema_editor):
    AcademicYear = apps.get_model("classes", "AcademicYear")
    AcademicYear.objects.filter(name="2026-2027").update(
        start_date=date(2026, 9, 7),
        end_date=date(2027, 6, 11),
    )


class Migration(migrations.Migration):
    dependencies = [
        ("classes", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(align_2026_2027_calendar, migrations.RunPython.noop),
    ]
