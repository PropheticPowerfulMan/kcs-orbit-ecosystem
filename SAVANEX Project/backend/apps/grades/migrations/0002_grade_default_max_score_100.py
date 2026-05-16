from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('grades', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='grade',
            name='max_score',
            field=models.DecimalField(decimal_places=2, default=100.0, max_digits=6, verbose_name='Max Score'),
        ),
    ]
