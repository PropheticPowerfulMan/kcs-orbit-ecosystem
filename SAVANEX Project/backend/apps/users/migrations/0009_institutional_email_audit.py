from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
class Migration(migrations.Migration):
    dependencies=[('users','0008_unique_school_email')]
    operations=[migrations.CreateModel(name='InstitutionalEmailAudit',fields=[('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),('old_value',models.EmailField(blank=True,max_length=254)),('new_value',models.EmailField(max_length=254)),('changed_at',models.DateTimeField(auto_now_add=True)),('reason',models.TextField()),('changed_by',models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name='institutional_email_changes',to=settings.AUTH_USER_MODEL)),('user',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='institutional_email_audits',to=settings.AUTH_USER_MODEL))],options={'db_table':'institutional_email_audits','ordering':['-changed_at']})]
