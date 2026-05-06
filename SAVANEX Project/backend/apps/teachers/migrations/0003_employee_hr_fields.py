from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('teachers', '0002_teacher_employee_fields'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='teacher',
            options={'ordering': ['user__last_name', 'user__first_name'], 'verbose_name': 'Employee', 'verbose_name_plural': 'Employees'},
        ),
        migrations.AddField(
            model_name='teacher',
            name='bank_account_number',
            field=models.CharField(blank=True, max_length=80, verbose_name='Bank Account Number'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='bank_name',
            field=models.CharField(blank=True, max_length=120, verbose_name='Bank Name'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='base_salary',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True, verbose_name='Base Salary'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='national_id_number',
            field=models.CharField(blank=True, max_length=60, verbose_name='National ID Number'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='office_phone_extension',
            field=models.CharField(blank=True, max_length=20, verbose_name='Office Phone Extension'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='pay_frequency',
            field=models.CharField(blank=True, choices=[('monthly', 'Monthly'), ('weekly', 'Weekly'), ('daily', 'Daily'), ('hourly', 'Hourly')], default='monthly', max_length=20, verbose_name='Pay Frequency'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='salary_grade',
            field=models.CharField(blank=True, max_length=50, verbose_name='Salary Grade'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='social_security_number',
            field=models.CharField(blank=True, max_length=60, verbose_name='Social Security Number'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='supervisor_name',
            field=models.CharField(blank=True, max_length=120, verbose_name='Supervisor Name'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='tax_number',
            field=models.CharField(blank=True, max_length=60, verbose_name='Tax Number'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='work_email',
            field=models.EmailField(blank=True, max_length=254, verbose_name='Work Email'),
        ),
    ]
