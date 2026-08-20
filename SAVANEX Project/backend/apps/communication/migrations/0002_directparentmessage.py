from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('communication', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DirectParentMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('recipient_external_id', models.CharField(blank=True, max_length=120)),
                ('recipient_name', models.CharField(max_length=200)),
                ('recipient_email', models.EmailField(blank=True, max_length=254)),
                ('recipient_phone', models.CharField(blank=True, max_length=40)),
                ('subject', models.CharField(max_length=200)),
                ('body', models.TextField()),
                ('channels', models.JSONField(default=list)),
                ('delivery', models.JSONField(default=list)),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('sender', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='direct_parent_messages', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'direct_parent_messages', 'ordering': ['-sent_at']},
        ),
    ]
