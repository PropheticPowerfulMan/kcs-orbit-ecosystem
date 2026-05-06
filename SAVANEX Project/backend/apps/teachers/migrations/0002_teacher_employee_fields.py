from django.db import migrations, models
import apps.teachers.models as teacher_models


def populate_employee_ids(apps, schema_editor):
    Teacher = apps.get_model('teachers', 'Teacher')
    for teacher in Teacher.objects.filter(employee_id__isnull=True):
        teacher.employee_id = teacher_models.generate_employee_id()
        teacher.save(update_fields=['employee_id'])

    for teacher in Teacher.objects.filter(employee_id=''):
        teacher.employee_id = teacher_models.generate_employee_id()
        teacher.save(update_fields=['employee_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('teachers', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='teacher',
            name='contract_type',
            field=models.CharField(blank=True, choices=[('permanent', 'Permanent'), ('temporary', 'Temporary'), ('part_time', 'Part Time'), ('consultant', 'Consultant')], max_length=20, verbose_name='Contract Type'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='department',
            field=models.CharField(blank=True, max_length=120, verbose_name='Department'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='emergency_contact_name',
            field=models.CharField(blank=True, max_length=120, verbose_name='Emergency Contact Name'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='emergency_contact_phone',
            field=models.CharField(blank=True, max_length=20, verbose_name='Emergency Contact Phone'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='employee_id',
            field=models.CharField(blank=True, max_length=20, null=True, verbose_name='Employee ID'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='employee_type',
            field=models.CharField(choices=[('teacher', 'Teacher'), ('administrative', 'Administrative Staff'), ('support', 'Support Staff'), ('leadership', 'Leadership'), ('specialist', 'Specialist')], default='teacher', max_length=20, verbose_name='Employee Type'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='employment_notes',
            field=models.TextField(blank=True, verbose_name='Employment Notes'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='employment_status',
            field=models.CharField(choices=[('active', 'Active'), ('on_leave', 'On Leave'), ('suspended', 'Suspended'), ('inactive', 'Inactive')], default='active', max_length=20, verbose_name='Employment Status'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='end_date',
            field=models.DateField(blank=True, null=True, verbose_name='End Date'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='job_title',
            field=models.CharField(blank=True, max_length=120, verbose_name='Job Title'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='payroll_reference',
            field=models.CharField(blank=True, max_length=50, verbose_name='Payroll Reference'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='work_location',
            field=models.CharField(blank=True, max_length=120, verbose_name='Work Location'),
        ),
        migrations.RunPython(populate_employee_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='teacher',
            name='employee_id',
            field=models.CharField(default=teacher_models.generate_employee_id, max_length=20, unique=True, verbose_name='Employee ID'),
        ),
    ]
