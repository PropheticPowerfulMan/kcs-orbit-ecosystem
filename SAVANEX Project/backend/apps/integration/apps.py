from django.apps import AppConfig


class IntegrationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.integration'
    label = 'integration'
    verbose_name = 'Integration'

    def ready(self):
        from apps.integration.worker import start_outbox_worker

        start_outbox_worker()