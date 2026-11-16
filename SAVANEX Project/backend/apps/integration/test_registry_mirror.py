from datetime import date
from unittest.mock import patch
from django.test import TestCase
from apps.users.models import User
from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.classes.models import Class, Level, AcademicYear
from .registry_mirror import reconcile_registry_mirrors

@patch('apps.integration.registry_mirror._load_outbox', return_value=[])
class RegistryMirrorTests(TestCase):
    def setUp(self):
        year=AcademicYear.objects.create(name='2026-2027',start_date=date(2026,9,1),end_date=date(2027,6,30),is_current=True)
        level=Level.objects.create(name='QA')
        self.old=Class.objects.create(name='Grade 1',level=level,academic_year=year)
        self.new=Class.objects.create(name='Grade 11',level=level,academic_year=year)
        self.user=User.objects.create(username='qa-student',email='old@example.invalid',role='student',password='PRESERVE-HASH',access_code='PRESERVE-ACCESS')
        self.student=Student.objects.create(user=self.user,student_id='QA-S1',gender='F',date_of_birth=date(2010,1,1),current_class=self.old)
        parent=User.objects.create(username='QA-P1',kcs_card_id='QA-P1',role='parent',email='parent@example.invalid')
        teacher=User.objects.create(username='qa-teacher',role='teacher',email='teacher@example.invalid')
        Teacher.objects.create(user=teacher,teacher_id='QA-T1',hire_date=date(2020,1,1))
        self.snapshot={'students':[{'id':'official-s1','studentNumber':'QA-S1','firstName':'New','lastName':'Name','email':'new@example.invalid','className':'Grade 11','parentId':'official-p1','status':'active'}], 'parents':[{'id':'official-p1','externalIds':[{'appSlug':'SAVANEX','externalId':'QA-P1'}], 'familyContacts':[{'email':'mother@example.invalid'}]}], 'teachers':[{'id':'official-t1','employeeId':'QA-T1'}], 'counts':{'students':1,'parents':1,'teachers':1}}

    def test_changes_propagate_without_credentials_or_history_loss(self, outbox):
        result=reconcile_registry_mirrors(self.snapshot)
        self.user.refresh_from_db();self.student.refresh_from_db()
        self.assertGreater(result['updated'],0)
        self.assertEqual(self.student.current_class_id,self.new.pk)
        self.assertEqual(self.user.email,'new@example.invalid')
        self.assertEqual(self.user.password,'PRESERVE-HASH')
        self.assertEqual(self.user.access_code,'PRESERVE-ACCESS')
        self.assertIsNotNone(self.student.parent_id)
        self.assertEqual(reconcile_registry_mirrors(self.snapshot)['updated'],0)

    def test_pending_local_edits_and_incomplete_directory_are_preserved(self, outbox):
        outbox.return_value=[{'id':'pending-local-edit'}]
        self.assertTrue(reconcile_registry_mirrors(self.snapshot)['deferred'])
        self.student.refresh_from_db();self.assertEqual(self.student.current_class_id,self.old.pk)
        outbox.return_value=[]
        self.snapshot['counts']['students']=2
        with self.assertRaises(ValueError):reconcile_registry_mirrors(self.snapshot)
        self.user.refresh_from_db();self.assertEqual(self.user.email,'old@example.invalid')

    def test_confirmed_deletion_disables_account_without_deleting_profile(self, outbox):
        self.snapshot['students']=[];self.snapshot['counts']['students']=0
        self.snapshot['deletedEntities']=[{'id':'official-s1','entityType':'student','externalIds':[{'appSlug':'SAVANEX','externalId':'QA-S1'}]}]
        self.assertEqual(reconcile_registry_mirrors(self.snapshot)['deactivated'],1)
        self.user.refresh_from_db();self.student.refresh_from_db()
        self.assertFalse(self.user.is_active);self.assertFalse(self.student.is_active)
        self.assertEqual(self.user.password,'PRESERVE-HASH')
        self.assertEqual(Student.objects.filter(pk=self.student.pk).count(),1)
