from django.test import SimpleTestCase

from .utils import normalize_class_display


class ClassDisplayNormalizationTests(SimpleTestCase):
    def test_collapses_repeated_grade_labels(self):
        self.assertEqual(normalize_class_display('Grade 6 Grade 6'), 'Grade 6')
        self.assertEqual(normalize_class_display('grade 9 grade 9 A'), 'Grade 9 A')

    def test_normalizes_kindergarten_variants(self):
        self.assertEqual(normalize_class_display('Kindergarten K3'), 'K3')
        self.assertEqual(normalize_class_display('Kindergarten Grade 3'), 'K3')
        self.assertEqual(normalize_class_display('K3'), 'K3')
