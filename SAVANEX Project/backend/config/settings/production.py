from .base import *
from decouple import config
from django.core.exceptions import ImproperlyConfigured

DEBUG = False

ALLOWED_HOSTS = [host.strip() for host in config('ALLOWED_HOSTS', default='').split(',') if host.strip()]
if 'savanex.kinshasachristianschool.org' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('savanex.kinshasachristianschool.org')

# CORS
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='').split(',')
CORS_ALLOW_CREDENTIALS = True

# Security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=False, cast=bool)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

if SECRET_KEY == 'django-insecure-change-me-in-production' or len(SECRET_KEY) < 32:
    raise ImproperlyConfigured('A strong SECRET_KEY is required in production.')
if not any(host.strip() for host in ALLOWED_HOSTS):
    raise ImproperlyConfigured('ALLOWED_HOSTS is required in production.')
if not any(origin.strip() for origin in CORS_ALLOWED_ORIGINS):
    raise ImproperlyConfigured('CORS_ALLOWED_ORIGINS is required in production.')
if DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql':
    raise ImproperlyConfigured('PostgreSQL is required in production.')
if DATABASES['default']['PASSWORD'] in {'', 'savanex_pass'}:
    raise ImproperlyConfigured('A non-default PostgreSQL password is required in production.')

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}
