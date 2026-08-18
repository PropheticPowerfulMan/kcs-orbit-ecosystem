from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('users', '0006_user_middle_name')]
    operations = [
        migrations.AddField(
            model_name='user',
            name='address',
            field=models.TextField(blank=True, verbose_name='Physical address'),
        ),
    ]