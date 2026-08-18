from django.db import migrations


def move_student_address_to_parent(apps, schema_editor):
    Student = apps.get_model('students', 'Student')
    User = apps.get_model('users', 'User')
    for student in Student.objects.exclude(address='').exclude(parent_id=None).iterator():
        parent = User.objects.filter(pk=student.parent_id).first()
        if parent and not parent.address:
            parent.address = student.address
            parent.save(update_fields=['address'])


class Migration(migrations.Migration):
    dependencies = [
        ('students', '0001_initial'),
        ('users', '0007_parent_address_and_remove_student_address'),
    ]
    operations = [
        migrations.RunPython(move_student_address_to_parent, migrations.RunPython.noop),
        migrations.RemoveField(model_name='student', name='address'),
    ]