import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('teachers', '0003_employee_hr_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='teacher',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now, verbose_name='System Entry Date'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='teacher',
            name='gender',
            field=models.CharField(blank=True, choices=[('M', 'Male'), ('F', 'Female'), ('O', 'Other')], max_length=1, verbose_name='Gender'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, verbose_name='Last Update Date'),
        ),
        migrations.AlterField(
            model_name='teacher',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, verbose_name='System Entry Date'),
        ),
    ]
