from datetime import date
from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.analytics.views import overview
from apps.attendance.models import Attendance
from apps.classes.models import AcademicYear, Class, ClassSubject, Level, Subject
from apps.grades.models import Grade, ReportCard
from apps.intelligence.models import EvolutionAlertDelivery, EvolutionEvent
from apps.intelligence.services import (
    build_period_state_report,
    export_events_excel,
    export_events_pdf,
    ingest_nexus_academic_event,
    observe_attendance,
    observe_grade,
    observe_report_card,
)
from apps.intelligence.views import ingest_nexus_academic
from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.users.models import User


class EcosystemIntelligenceSimulationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = User.objects.create_user(
            username='admin-intelligence',
            email='admin.intelligence@example.com',
            password='AdminPass123!',
            first_name='Admin',
            last_name='Intelligence',
            role=User.ROLE_ADMIN,
        )
        self.parent = User.objects.create_user(
            username='parent-intelligence',
            email='parent.intelligence@example.com',
            password='ParentPass123!',
            first_name='Mireille',
            last_name='Mbuyi',
            phone='+243000000001',
            role=User.ROLE_PARENT,
        )
        self.student_user = User.objects.create_user(
            username='student-intelligence',
            email='student.intelligence@example.com',
            password='StudentPass123!',
            first_name='Grace',
            last_name='Mbuyi',
            role=User.ROLE_STUDENT,
        )
        self.teacher_user = User.objects.create_user(
            username='teacher-intelligence',
            email='teacher.intelligence@example.com',
            password='TeacherPass123!',
            first_name='Aline',
            last_name='Kabeya',
            role=User.ROLE_TEACHER,
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user,
            teacher_id='TCH-INT-001',
            employee_id='EMP-INT-001',
            hire_date=date(2026, 1, 5),
            specialization='Mathematiques',
        )
        year = AcademicYear.objects.create(name='2026-2027', start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), is_current=True)
        level = Level.objects.create(name='Grade 6', order=6)
        class_instance = Class.objects.create(name='Grade 6 A', level=level, academic_year=year, class_teacher=self.teacher)
        subject = Subject.objects.create(name='Mathematiques', code='MATH6', coefficient=Decimal('2.00'))
        self.class_subject = ClassSubject.objects.create(class_instance=class_instance, subject=subject, teacher=self.teacher)
        self.student = Student.objects.create(
            user=self.student_user,
            student_id='STU-INT-001',
            date_of_birth=date(2014, 2, 20),
            gender='F',
            parent=self.parent,
            current_class=class_instance,
        )
        self.year = year

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', SMS_ENABLED=False)
    def test_full_living_ecosystem_simulation_records_alerts_and_reports(self):
        attendance = Attendance.objects.create(
            student=self.student,
            class_subject=self.class_subject,
            date=timezone.localdate(),
            status=Attendance.STATUS_ABSENT,
            recorded_by=self.teacher_user,
        )
        grade = Grade.objects.create(
            student=self.student,
            class_subject=self.class_subject,
            academic_year=self.year,
            term='T1',
            grade_type=Grade.TYPE_QUIZ,
            score=Decimal('7.00'),
            max_score=Decimal('100.00'),
            weight=Decimal('1.00'),
            date=timezone.localdate(),
            entered_by=self.teacher_user,
        )
        report = ReportCard.objects.create(
            student=self.student,
            academic_year=self.year,
            term='T1',
            overall_average=Decimal('7.00'),
            data={'source': 'simulation'},
        )

        attendance_event = observe_attendance(attendance, actor=self.teacher_user)
        grade_event = observe_grade(grade, actor=self.teacher_user)
        report_event = observe_report_card(report)
        nexus_event = ingest_nexus_academic_event({
            'organizationId': 'org_test',
            'externalId': 'nexus-grade-001',
            'sourceApp': 'KCS_NEXUS',
            'occurredAt': timezone.now().isoformat(),
            'version': '1.0.0',
            'payload': {
                'eventType': 'grade',
                'studentExternalId': self.student.student_id,
                'studentName': self.student.full_name,
                'subject': 'Sciences',
                'title': 'Evaluation laboratoire',
                'score': 40,
                'maxScore': 100,
                'riskLevel': 'high',
                'recommendation': 'Remediation scientifique immediate.',
            },
        })

        self.assertEqual(EvolutionEvent.objects.count(), 4)
        self.assertEqual(attendance_event.severity, EvolutionEvent.SEVERITY_CRITICAL)
        self.assertEqual(grade_event.severity, EvolutionEvent.SEVERITY_CRITICAL)
        self.assertEqual(report_event.event_type, EvolutionEvent.EVENT_REPORT_CARD)
        self.assertEqual(nexus_event.event_type, EvolutionEvent.EVENT_NEXUS_GRADE)
        self.assertEqual(nexus_event.severity, EvolutionEvent.SEVERITY_CRITICAL)
        self.assertGreater(EvolutionAlertDelivery.objects.count(), 0)

        queryset = EvolutionEvent.objects.all()
        period_report = build_period_state_report(queryset, start=timezone.localdate(), end=timezone.localdate())
        self.assertEqual(period_report['population']['active_students'], 1)
        self.assertEqual(period_report['attendance']['records'], 1)
        self.assertEqual(period_report['attendance']['rate'], 0.0)
        self.assertEqual(period_report['performance']['average_normalized'], 7.0)
        self.assertEqual(period_report['performance']['nexus_academic_events'], 1)
        self.assertEqual(period_report['performance']['nexus_average_percentage'], 40.0)
        self.assertEqual(period_report['intelligence']['events'], 4)

        pdf_response = export_events_pdf(queryset, start=timezone.localdate(), end=timezone.localdate())
        excel_response = export_events_excel(queryset, start=timezone.localdate(), end=timezone.localdate())
        self.assertEqual(pdf_response['Content-Type'], 'application/pdf')
        self.assertIn('application/vnd.ms-excel', excel_response['Content-Type'])
        self.assertGreater(len(pdf_response.content), 500)
        self.assertIn(b'Rapport de vie de l ecosysteme', excel_response.content)

    @override_settings(INTELLIGENCE_INGEST_API_KEY='secret')
    def test_nexus_ingestion_endpoint_rejects_bad_keys_and_accepts_valid_signals(self):
        bad_request = self.factory.post(
            '/api/intelligence/ingest/nexus/academic/',
            {'sourceApp': 'KCS_NEXUS', 'payload': {'subject': 'Sciences'}},
            format='json',
            HTTP_X_API_KEY='wrong',
            HTTP_X_APP_SLUG='KCS_NEXUS',
        )
        bad_response = ingest_nexus_academic(bad_request)
        self.assertEqual(bad_response.status_code, 403)

        good_request = self.factory.post(
            '/api/intelligence/ingest/nexus/academic/',
            {
                'sourceApp': 'KCS_NEXUS',
                'externalId': 'nexus-signal-accepted',
                'payload': {
                    'eventType': 'recommendation',
                    'studentExternalId': self.student.student_id,
                    'subject': 'Physique',
                    'riskLevel': 'medium',
                },
            },
            format='json',
            HTTP_X_API_KEY='secret',
            HTTP_X_APP_SLUG='KCS_NEXUS',
        )
        good_response = ingest_nexus_academic(good_request)
        self.assertEqual(good_response.status_code, 201)
        self.assertEqual(EvolutionEvent.objects.get().event_type, EvolutionEvent.EVENT_NEXUS_AI)

    def test_analytics_report_real_data_quality_without_synthetic_defaults(self):
        request = self.factory.get('/api/analytics/overview/')
        force_authenticate(request, user=self.admin)
        response = overview(request)

        self.assertIsNone(response.data['attendance_rate_30d'])
        self.assertIsNone(response.data['average_grade'])
        self.assertFalse(response.data['data_quality']['attendance_rate_is_available'])
        self.assertFalse(response.data['data_quality']['average_grade_is_available'])
