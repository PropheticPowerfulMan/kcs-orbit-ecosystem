from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('teachers', '0004_teacher_gender_timestamps')]

    operations = [
        migrations.AlterField(model_name='teacher', name='contract_type', field=models.CharField(blank=True, choices=[('permanent', 'Permanent'), ('temporary', 'Temporary'), ('part_time', 'Part Time'), ('consultant', 'Consultant'), ('internship', 'Internship')], max_length=20, verbose_name='Contract Type')),
        migrations.AddField(model_name='teacher', name='contract_duration_months', field=models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Contract Duration (Months)')),
        migrations.AddField(model_name='teacher', name='birth_date', field=models.DateField(blank=True, null=True, verbose_name='Birth Date')),
        migrations.AddField(model_name='teacher', name='birth_place', field=models.CharField(blank=True, max_length=120, verbose_name='Birth Place')),
        migrations.AddField(model_name='teacher', name='nationality', field=models.CharField(blank=True, max_length=80, verbose_name='Nationality')),
        migrations.AddField(model_name='teacher', name='identity_document_type', field=models.CharField(blank=True, max_length=40, verbose_name='Identity Document Type')),
        migrations.AddField(model_name='teacher', name='identity_document_other', field=models.CharField(blank=True, max_length=80, verbose_name='Other Identity Document')),
        migrations.AddField(model_name='teacher', name='residential_address', field=models.TextField(blank=True, verbose_name='Residential Address')),
        migrations.AddField(model_name='teacher', name='secondary_phone', field=models.CharField(blank=True, max_length=20, verbose_name='Secondary Phone')),
        migrations.AddField(model_name='teacher', name='personal_email', field=models.EmailField(blank=True, max_length=254, verbose_name='Personal Email')),
        migrations.AddField(model_name='teacher', name='email_contact_preference', field=models.CharField(blank=True, default='both', max_length=20, verbose_name='Email Contact Preference')),
        migrations.AddField(model_name='teacher', name='onem_number', field=models.CharField(blank=True, max_length=60, verbose_name='ONEM Number')),
        migrations.AddField(model_name='teacher', name='bank_swift_iban', field=models.CharField(blank=True, max_length=80, verbose_name='SWIFT / IBAN')),
        migrations.AddField(model_name='teacher', name='emergency_contact_relationship', field=models.CharField(blank=True, max_length=60, verbose_name='Emergency Contact Relationship')),
        migrations.AddField(model_name='teacher', name='emergency_contact_phone_secondary', field=models.CharField(blank=True, max_length=20, verbose_name='Secondary Emergency Phone')),
        migrations.AddField(model_name='teacher', name='marital_status', field=models.CharField(blank=True, max_length=20, verbose_name='Marital Status')),
        migrations.AddField(model_name='teacher', name='spouse_full_name', field=models.CharField(blank=True, max_length=120, verbose_name='Spouse Full Name')),
        migrations.AddField(model_name='teacher', name='spouse_phone', field=models.CharField(blank=True, max_length=20, verbose_name='Spouse Phone')),
        migrations.AddField(model_name='teacher', name='spouse_occupation', field=models.CharField(blank=True, max_length=120, verbose_name='Spouse Occupation')),
        migrations.AddField(model_name='teacher', name='children', field=models.JSONField(blank=True, default=list, verbose_name='Children')),
    ]