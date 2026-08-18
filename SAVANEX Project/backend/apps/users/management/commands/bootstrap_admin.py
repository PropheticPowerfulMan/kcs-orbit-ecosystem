import os

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.users.models import User


class Command(BaseCommand):
    help = 'Create the initial SAVANEX production administrator from environment variables.'

    def handle(self, *args, **options):
        username = os.environ.get('SAVANEX_ADMIN_USERNAME', '').strip()
        email = os.environ.get('SAVANEX_ADMIN_EMAIL', '').strip()
        password = os.environ.get('SAVANEX_ADMIN_PASSWORD', '')
        configured = (username, email, password)

        if not any(configured):
            self.stdout.write('Initial administrator not configured; skipping bootstrap.')
            return
        if not all(configured):
            raise CommandError('All SAVANEX_ADMIN_* variables must be set.')

        existing = User.objects.filter(username__iexact=username).first()
        if existing:
            if not (existing.role == User.ROLE_ADMIN and existing.is_staff and existing.is_superuser):
                raise CommandError(f'Existing user {username} is not a production administrator.')
            self.stdout.write(f'Production administrator {username} already exists; unchanged.')
            return

        candidate = User(username=username, email=email)
        try:
            validate_password(password, user=candidate)
        except ValidationError as exc:
            raise CommandError('Invalid initial password: ' + ' '.join(exc.messages)) from exc

        user = User.objects.create_superuser(username=username, email=email, password=password)
        user.role = User.ROLE_ADMIN
        user.language = 'fr'
        user.must_change_password = True
        user.password_generated_by_system = True
        user.save(update_fields=['role', 'language', 'must_change_password', 'password_generated_by_system'])
        self.stdout.write(self.style.SUCCESS(f'Production administrator {username} created.'))
