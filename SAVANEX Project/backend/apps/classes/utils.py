import re
from datetime import date

from .models import AcademicYear, Class, Level


KINDERGARTEN_LEVELS = [f"K{number}" for number in range(3, 6)]
GRADE_LEVELS = [f"Grade {number}" for number in range(1, 13)]
STANDARD_CLASS_LEVELS = KINDERGARTEN_LEVELS + GRADE_LEVELS
SECTION_SUFFIXES = [chr(code) for code in range(ord("A"), ord("Z") + 1)]


def default_academic_year_dates(start_year: int) -> tuple[date, date]:
    if start_year == 2026:
        return date(2026, 9, 7), date(2027, 6, 11)

    return date(start_year, 9, 1), date(start_year + 1, 6, 30)


def normalize_class_level(value: str) -> str:
    raw = (value or "").strip()
    compact = re.sub(r"\s+", " ", raw).upper()

    kindergarten = re.fullmatch(r"K\s*([3-5])", compact)
    if kindergarten:
        return f"K{kindergarten.group(1)}"

    grade = re.fullmatch(r"(?:GRADE|G)\s*([1-9]|1[0-2])", compact)
    if grade:
        return f"Grade {int(grade.group(1))}"

    raise ValueError("La classe doit etre comprise entre K3-K5 ou Grade 1-Grade 12.")


def normalize_class_display(value: str | None) -> str:
    raw = re.sub(r"\s+", " ", (value or "").strip())
    raw = re.sub(r"\s*\(\s*20\d{2}\s*[-/]\s*20\d{2}\s*\)\s*$", "", raw).strip()
    kindergarten = re.fullmatch(
        r"(?:kindergarten\s+)*(?:grade\s+)?k?\s*([3-5])"
        r"(?:\s+(?:kindergarten\s+)*(?:grade\s+)?k?\s*\1)*"
        r"(?:\s+([A-Z]))?",
        raw,
        re.IGNORECASE,
    )
    if kindergarten:
        suffix = f" {kindergarten.group(2).upper()}" if kindergarten.group(2) else ""
        return f"K{kindergarten.group(1)}{suffix}"
    grade = re.fullmatch(
        r"(?:grade\s+)([1-9]|1[0-2])"
        r"(?:\s+grade\s+\1)*(?:\s+([A-Z]))?",
        raw,
        re.IGNORECASE,
    )
    if grade:
        suffix = f" {grade.group(2).upper()}" if grade.group(2) else ""
        return f"Grade {int(grade.group(1))}{suffix}"
    return raw


def normalize_class_suffix(value: str | None) -> str:
    suffix = (value or "").strip().upper()
    if not suffix:
        return ""
    if suffix not in SECTION_SUFFIXES:
        raise ValueError("Le suffixe de classe doit etre une lettre de A a Z.")
    return suffix


def build_class_name(level_name: str, suffix: str | None = "") -> str:
    normalized_level = normalize_class_level(level_name)
    normalized_suffix = normalize_class_suffix(suffix)
    return f"{normalized_level} {normalized_suffix}".strip()


def current_or_default_academic_year() -> AcademicYear:
    from django.db import transaction
    from rest_framework.exceptions import ValidationError
    from apps.integration.school_calendar import read_published_school_calendar
    published = read_published_school_calendar()
    if published:
        with transaction.atomic():
            year, _ = AcademicYear.objects.get_or_create(name=published['name'], defaults={'start_date': published['startDate'][:10], 'end_date': published['endDate'][:10], 'is_current': False})
            start_date = date.fromisoformat(published['startDate'][:10])
            end_date = date.fromisoformat(published['endDate'][:10])
            is_current = bool(published.get('isCurrent'))
            if year.start_date != start_date or year.end_date != end_date or year.is_current != is_current:
                year.start_date, year.end_date, year.is_current = start_date, end_date, is_current
                year.save(update_fields=['start_date', 'end_date', 'is_current'])
            return year
    current_year = AcademicYear.objects.filter(is_current=True).first()
    if current_year:
        return current_year
    historical = AcademicYear.objects.order_by('-start_date').first()
    if historical:
        return historical
    raise ValidationError('Publish the official school calendar before creating classes.')


def get_or_create_standard_class(level_name: str, suffix: str | None = "") -> Class:
    normalized_level = normalize_class_level(level_name)
    normalized_suffix = normalize_class_suffix(suffix)
    class_name = build_class_name(normalized_level, normalized_suffix)
    academic_year = current_or_default_academic_year()
    if not academic_year.is_current:
        from rest_framework.exceptions import ValidationError
        raise ValidationError('The school year is closed. Activate the next year through school leadership.')
    level, _ = Level.objects.get_or_create(
        name=normalized_level,
        defaults={"order": STANDARD_CLASS_LEVELS.index(normalized_level) + 1},
    )
    klass, _ = Class.objects.get_or_create(
        name=class_name,
        academic_year=academic_year,
        defaults={"level": level},
    )

    if klass.level_id != level.id:
        klass.level = level
        klass.save(update_fields=["level"])

    return klass
