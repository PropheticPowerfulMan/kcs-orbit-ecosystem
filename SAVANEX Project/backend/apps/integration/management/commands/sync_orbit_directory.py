from django.core.management.base import BaseCommand

from apps.classes.models import Class
from apps.integration.orbit import (
    flush_outbox,
    orbit_sync_is_enabled,
    sync_class,
    sync_parent,
    sync_student,
    sync_teacher,
)
from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.users.models import User


class Command(BaseCommand):
    help = "Replay the SAVANEX school directory into KCS Orbit."

    def add_arguments(self, parser):
        parser.add_argument(
            "--include-inactive",
            action="store_true",
            help="Also sync inactive users, students, and teachers.",
        )

    def handle(self, *args, **options):
        if not orbit_sync_is_enabled():
            self.stdout.write(self.style.WARNING("Orbit sync is disabled; missing KCS_ORBIT_* configuration."))
            return

        include_inactive = options["include_inactive"]
        initial_flush_count = flush_outbox(max_items=1000)

        parents = User.objects.filter(role=User.ROLE_PARENT).order_by("last_name", "first_name")
        students = Student.objects.select_related("user", "parent", "current_class", "current_class__level").order_by("student_id")
        teachers = Teacher.objects.select_related("user").order_by("teacher_id")
        classes = Class.objects.select_related("level", "class_teacher", "class_teacher__user").order_by("level__order", "name")

        if not include_inactive:
            parents = parents.filter(is_active=True)
            students = students.filter(is_active=True, user__is_active=True)
            teachers = teachers.filter(is_active=True, user__is_active=True)

        counts = {
            "parents": 0,
            "classes": 0,
            "students": 0,
            "teachers": 0,
        }

        for parent in parents.iterator():
            sync_parent(parent)
            counts["parents"] += 1

        for teacher in teachers.iterator():
            sync_teacher(teacher)
            counts["teachers"] += 1

        for class_instance in classes.iterator():
            sync_class(class_instance)
            counts["classes"] += 1

        for student in students.iterator():
            sync_student(student)
            counts["students"] += 1

        final_flush_count = flush_outbox(max_items=1000)
        self.stdout.write(
            self.style.SUCCESS(
                "Orbit directory sync requested: "
                f"{counts['parents']} parents, "
                f"{counts['teachers']} teachers, "
                f"{counts['classes']} classes, "
                f"{counts['students']} students. "
                f"Outbox flushed: {initial_flush_count + final_flush_count}."
            )
        )
