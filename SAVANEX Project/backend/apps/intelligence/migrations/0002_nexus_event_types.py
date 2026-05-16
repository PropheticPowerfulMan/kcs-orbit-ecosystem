from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('intelligence', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='evolutionevent',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('grade', 'Grade'),
                    ('attendance', 'Attendance'),
                    ('profile', 'Profile'),
                    ('report_card', 'Report Card'),
                    ('nexus_academic', 'Nexus Academic Signal'),
                    ('nexus_grade', 'Nexus Grade'),
                    ('nexus_pedagogy', 'Nexus Pedagogy'),
                    ('nexus_ai', 'Nexus AI Recommendation'),
                    ('system', 'System'),
                ],
                default='system',
                max_length=30,
            ),
        ),
    ]
