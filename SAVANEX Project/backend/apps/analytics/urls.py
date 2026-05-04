from django.urls import path
from .views import overview, early_warning

urlpatterns = [
    path('overview/', overview, name='analytics-overview'),
    path('early-warning/', early_warning, name='analytics-early-warning'),
]
