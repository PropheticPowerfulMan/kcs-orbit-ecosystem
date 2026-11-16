"""Reconcile existing source identities from the official registry, without changing credentials."""
import logging
import re
from django.core.cache import cache
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from apps.users.models import User
from apps.students.models import Student
from apps.teachers.models import Teacher
from apps.classes.models import Class
from .orbit import fetch_shared_directory, _load_outbox
logger=logging.getLogger(__name__)
INACTIVE={'ARCHIVED','GRADUATED','DISMISSED','EXPELLED','DELETED','INACTIVE'}
def class_key(value):
    value=re.sub(r'[^a-z0-9]','',str(value or '').lower())
    return re.sub(r'(grade(?:1[0-2]|[1-9]))\1',r'\1',value)
def identifiers(entity):
    return {str(value).strip() for value in [entity.get('id'),entity.get('studentNumber'),entity.get('employeeId'),*(row.get('externalId') for row in entity.get('externalIds',[]) if row.get('appSlug')=='SAVANEX')] if value}
def source_identity(entity,kind):
    keys=identifiers(entity)
    if kind=='student':
        rows=list(Student.objects.select_related('user','current_class','current_class__academic_year').filter(student_id__in=keys)[:2])
        return (rows[0].user,rows[0]) if len(rows)==1 else (None,None)
    if kind=='teacher':
        rows=list(Teacher.objects.select_related('user').filter(Q(teacher_id__in=keys)|Q(employee_id__in=keys))[:2])
        return (rows[0].user,rows[0]) if len(rows)==1 else (None,None)
    rows=list(User.objects.filter(role=User.ROLE_PARENT).filter(Q(kcs_card_id__in=keys)|Q(username__in=keys))[:2])
    return (rows[0],None) if len(rows)==1 else (None,None)
def reconcile_registry_mirrors(snapshot=None):
    # Pending local edits must reach Orbit before incoming data may be applied.
    if _load_outbox():return {'updated':0,'deactivated':0,'deferred':True}
    began=timezone.now();data=snapshot if snapshot is not None else fetch_shared_directory()
    if any(not isinstance(data.get(key),list) for key in ('students','parents','teachers')):raise ValueError('Incomplete official registry; source records preserved')
    counts=data.get('counts',{})
    if any(counts.get(key)!=len(data[key]) for key in ('students','parents','teachers')):raise ValueError('Registry counts mismatch; source records preserved')
    if not data['teachers'] and (data['students'] or data['parents']):raise ValueError('Teacher collection missing; source records preserved')
    updated=deactivated=0
    parent_map={row['id']:source_identity(row,'parent')[0] for row in data['parents']}
    classes=list(Class.objects.select_related('academic_year').all())
    for identity in data.get('deletedEntities',[]):
        if identity.get('entityType') not in ('student','parent','teacher'):continue
        user,profile=source_identity(identity,identity.get('entityType'))
        if not user or user.is_superuser:continue
        with transaction.atomic():
            count=User.objects.filter(pk=user.pk,is_active=True,updated_at__lte=began).update(is_active=False,updated_at=timezone.now())
            if profile is not None:type(profile).objects.filter(pk=profile.pk).update(is_active=False)
            deactivated+=count
    for kind,key in [('parent','parents'),('student','students'),('teacher','teachers')]:
        for entity in data[key]:
            user,profile=source_identity(entity,kind)
            if not user or user.is_superuser or user.updated_at>began:continue
            changes={}
            for canonical,local in [('firstName','first_name'),('middleName','middle_name'),('lastName','last_name'),('phone','phone'),('physicalAddress','address'),('photoData','photo_data')]:
                if canonical in entity:
                    value=str(entity[canonical] or '').strip()
                    if canonical in ('firstName','lastName') and not value:continue
                    if value!=getattr(user,local):changes[local]=value
            email=str(entity.get('email') or '').strip().lower()
            if email and email!=user.email.lower():
                if User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():logger.warning('Canonical email conflict for source identity %s; reconciliation deferred',user.pk);continue
                changes['email']=email
            if kind=='parent' and isinstance(entity.get('familyContacts'),list) and entity['familyContacts']!=user.family_contacts:changes['family_contacts']=entity['familyContacts']
            profile_changes={}
            if kind=='student':
                if str(entity.get('status') or '').upper() in INACTIVE:changes['is_active']=False;profile_changes['is_active']=False
                target=class_key(entity.get('className'))
                matches=[row for row in classes if class_key(row.name)==target] if target else []
                if len(matches)>1 and profile.current_class_id:matches=[row for row in matches if row.academic_year_id==profile.current_class.academic_year_id]
                if len(matches)==1 and matches[0].pk!=profile.current_class_id:profile_changes['current_class_id']=matches[0].pk
                cache.set('savanex:official-placement:'+str(profile.pk),{'sourceClassId':profile_changes.get('current_class_id',profile.current_class_id),'className':entity.get('className')},timeout=86400)
                if 'parentId' in entity:
                    parent=parent_map.get(entity['parentId'])
                    if entity['parentId'] is None or parent:
                        parent_id=parent.pk if parent else None
                        if parent_id!=profile.parent_id:profile_changes['parent_id']=parent_id
            if kind=='teacher':
                for canonical,local in [('department','department'),('jobTitle','job_title'),('subject','specialization')]:
                    value=entity.get(canonical)
                    if value is not None and str(value)!=str(getattr(profile,local)):profile_changes[local]=str(value)
                value=entity.get('employeeType')
                if value in dict(Teacher.EMPLOYEE_TYPE_CHOICES) and value!=profile.employee_type:profile_changes['employee_type']=value
            if not changes and not profile_changes:continue
            with transaction.atomic():
                locked=User.objects.select_for_update().get(pk=user.pk)
                if locked.updated_at!=user.updated_at:continue
                if changes:User.objects.filter(pk=user.pk).update(**changes,updated_at=timezone.now())
                if profile_changes:type(profile).objects.filter(pk=profile.pk).update(**profile_changes)
                updated+=1
    if updated or deactivated:logger.info('Official registry mirrors reconciled: %s updated, %s deactivated; credentials preserved',updated,deactivated)
    return {'updated':updated,'deactivated':deactivated,'deferred':False}
