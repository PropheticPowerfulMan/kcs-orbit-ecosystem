from datetime import date
from django.test import SimpleTestCase

from .utils import default_academic_year_dates, normalize_class_display


class ClassDisplayNormalizationTests(SimpleTestCase):
    def test_collapses_repeated_grade_labels(self):
        self.assertEqual(normalize_class_display('Grade 6 Grade 6'), 'Grade 6')
        self.assertEqual(normalize_class_display('grade 9 grade 9 A'), 'Grade 9 A')
        self.assertEqual(normalize_class_display('Grade 1 (2025-2026)'), 'Grade 1')

    def test_normalizes_kindergarten_variants(self):
        self.assertEqual(normalize_class_display('Kindergarten K3'), 'K3')
        self.assertEqual(normalize_class_display('Kindergarten Grade 3'), 'K3')
        self.assertEqual(normalize_class_display('K3'), 'K3')


class AcademicYearDateTests(SimpleTestCase):
    def test_2026_2027_uses_the_official_kcs_calendar(self):
        self.assertEqual(
            default_academic_year_dates(2026),
            (date(2026, 9, 7), date(2027, 6, 11)),
        )
