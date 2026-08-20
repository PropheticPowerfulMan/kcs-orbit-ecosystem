from .base import *

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

# CORS — allow all origins in development
CORS_ALLOW_ALL_ORIGINS = True

# Use SQLite for fast local development (override to PostgreSQL by setting env vars)
import os
if os.environ.get('DB_NAME'):
    pass  # Use PostgreSQL from base settings
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Email — print to console
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Django Debug Toolbar (optional)
INSTALLED_APPS += ['django_extensions']

# Local dashboards poll several endpoints frequently. Keep throttling enabled, but
# use development-sized limits so normal navigation and post-save refreshes do not
# exhaust the production-oriented hourly quota.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    'DEFAULT_THROTTLE_RATES': {
        **REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'],
        'anon': os.environ.get('DRF_DEV_ANON_THROTTLE_RATE', '10000/hour'),
        'user': os.environ.get('DRF_DEV_USER_THROTTLE_RATE', '100000/hour'),
    },
}
# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'root': {
        'handlers': ['console'],
        'level': 'DEBUG',
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}
