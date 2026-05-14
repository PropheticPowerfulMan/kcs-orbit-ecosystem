import re
from datetime import date

from .models import AcademicYear, Class, Level


KINDERGARTEN_LEVELS = [f"K{number}" for number in range(3, 6)]
GRADE_LEVELS = [f"Grade {number}" for number in range(1, 13)]
STANDARD_CLASS_LEVELS = KINDERGARTEN_LEVELS + GRADE_LEVELS
SECTION_SUFFIXES = [chr(code) for code in range(ord("A"), ord("Z") + 1)]


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
    current_year = AcademicYear.objects.filter(is_current=True).first()
    if current_year:
        return current_year

    today = date.today()
    start_year = today.year if today.month >= 8 else today.year - 1
    return AcademicYear.objects.create(
        name=f"{start_year}-{start_year + 1}",
        start_date=date(start_year, 8, 1),
        end_date=date(start_year + 1, 7, 31),
        is_current=True,
    )


def get_or_create_standard_class(level_name: str, suffix: str | None = "") -> Class:
    normalized_level = normalize_class_level(level_name)
    normalized_suffix = normalize_class_suffix(suffix)
    class_name = build_class_name(normalized_level, normalized_suffix)
    academic_year = current_or_default_academic_year()
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
