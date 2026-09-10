from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0009_institutional_email_audit'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='family_contacts',
            field=models.JSONField(blank=True, default=list, verbose_name='Family contacts'),
        ),
    ]
