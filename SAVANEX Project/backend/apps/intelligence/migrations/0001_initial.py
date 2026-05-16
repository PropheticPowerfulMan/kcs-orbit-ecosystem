from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('contenttypes', '0002_remove_content_type_name'),
        ('students', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='EvolutionEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('object_id', models.PositiveIntegerField(blank=True, null=True)),
                ('entity_type', models.CharField(max_length=80, verbose_name='Entity Type')),
                ('entity_id', models.CharField(blank=True, max_length=80, verbose_name='Entity ID')),
                ('entity_label', models.CharField(max_length=220, verbose_name='Entity Label')),
                ('event_type', models.CharField(choices=[('grade', 'Grade'), ('attendance', 'Attendance'), ('profile', 'Profile'), ('report_card', 'Report Card'), ('system', 'System')], default='system', max_length=30)),
                ('severity', models.CharField(choices=[('info', 'Information'), ('success', 'Positive Evolution'), ('warning', 'Warning'), ('critical', 'Critical Alert')], default='info', max_length=20)),
                ('title', models.CharField(max_length=220)),
                ('summary', models.TextField(blank=True)),
                ('metrics', models.JSONField(blank=True, default=dict)),
                ('snapshot', models.JSONField(blank=True, default=dict)),
                ('period_start', models.DateField(blank=True, null=True)),
                ('period_end', models.DateField(blank=True, null=True)),
                ('alerts_sent', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='evolution_events_created', to=settings.AUTH_USER_MODEL, verbose_name='Actor')),
                ('content_type', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='contenttypes.contenttype')),
                ('subject_student', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='evolution_events', to='students.student', verbose_name='Concerned Student')),
            ],
            options={
                'db_table': 'evolution_events',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='EvolutionAlertDelivery',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel', models.CharField(choices=[('in_app', 'In App'), ('email', 'Email'), ('sms', 'SMS')], max_length=20)),
                ('status', models.CharField(max_length=30)),
                ('detail', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deliveries', to='intelligence.evolutionevent')),
                ('recipient', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='evolution_alert_deliveries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'evolution_alert_deliveries',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='evolutionevent',
            index=models.Index(fields=['event_type', 'severity'], name='evolution_e_event_t_acec72_idx'),
        ),
        migrations.AddIndex(
            model_name='evolutionevent',
            index=models.Index(fields=['entity_type', 'entity_id'], name='evolution_e_entity__82ec6c_idx'),
        ),
        migrations.AddIndex(
            model_name='evolutionevent',
            index=models.Index(fields=['period_start', 'period_end'], name='evolution_e_period__353e04_idx'),
        ),
        migrations.AddIndex(
            model_name='evolutionevent',
            index=models.Index(fields=['created_at'], name='evolution_e_created_937904_idx'),
        ),
    ]
