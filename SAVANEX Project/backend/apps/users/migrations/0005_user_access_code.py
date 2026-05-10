from django.db import migrations, models

from apps.users import models as user_models


def populate_access_codes(apps, schema_editor):
    User = apps.get_model('users', 'User')
    generate_access_code = user_models.generate_access_code

    for user in User.objects.filter(access_code__isnull=True):
        access_code = generate_access_code()
        while User.objects.filter(access_code=access_code).exists():
            access_code = generate_access_code()
        user.access_code = access_code
        user.save(update_fields=['access_code'])

    for user in User.objects.filter(access_code=''):
        access_code = generate_access_code()
        while User.objects.filter(access_code=access_code).exists():
            access_code = generate_access_code()
        user.access_code = access_code
        user.save(update_fields=['access_code'])


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_user_password_policy_flags'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='access_code',
            field=models.CharField(blank=True, default='', max_length=24, verbose_name='Access Code'),
        ),
        migrations.RunPython(populate_access_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='user',
            name='access_code',
            field=models.CharField(default=user_models.generate_access_code, max_length=24, unique=True, verbose_name='Access Code'),
        ),
    ]
