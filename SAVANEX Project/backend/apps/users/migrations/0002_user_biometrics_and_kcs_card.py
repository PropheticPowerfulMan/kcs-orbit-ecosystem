from uuid import uuid4

from django.db import migrations, models
import apps.users.models as user_models


def generate_card_id(role):
    prefix = (role or 'usr')[:3].upper()
    return f"KCS-{prefix}-{uuid4().hex[:8].upper()}"


def populate_kcs_card_ids(apps, schema_editor):
    User = apps.get_model('users', 'User')
    for user in User.objects.filter(kcs_card_id__isnull=True):
        user.kcs_card_id = generate_card_id(user.role)
        user.save(update_fields=['kcs_card_id'])

    for user in User.objects.filter(kcs_card_id=''):
        user.kcs_card_id = generate_card_id(user.role)
        user.save(update_fields=['kcs_card_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='photo_data',
            field=models.TextField(blank=True, verbose_name='Photo Data'),
        ),
        migrations.AddField(
            model_name='user',
            name='photo_source',
            field=models.CharField(blank=True, choices=[('upload', 'Upload'), ('camera', 'Camera')], max_length=20, verbose_name='Photo Source'),
        ),
        migrations.AddField(
            model_name='user',
            name='left_fingerprint_data',
            field=models.TextField(blank=True, verbose_name='Left Fingerprint Data'),
        ),
        migrations.AddField(
            model_name='user',
            name='right_fingerprint_data',
            field=models.TextField(blank=True, verbose_name='Right Fingerprint Data'),
        ),
        migrations.AddField(
            model_name='user',
            name='kcs_card_id',
            field=models.CharField(blank=True, max_length=24, null=True, verbose_name='KCS Card ID'),
        ),
        migrations.RunPython(populate_kcs_card_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='user',
            name='kcs_card_id',
            field=models.CharField(default=user_models.generate_kcs_card_id, max_length=24, unique=True, verbose_name='KCS Card ID'),
        ),
    ]
