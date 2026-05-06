from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_user_biometrics_and_kcs_card'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(choices=[('admin', 'Admin'), ('employee', 'Employee'), ('teacher', 'Teacher'), ('student', 'Student'), ('parent', 'Parent')], default='student', max_length=20, verbose_name='Role'),
        ),
    ]
