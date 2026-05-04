from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TimeSlotViewSet

router = DefaultRouter()
router.register(r'slots', TimeSlotViewSet, basename='timeslot')

urlpatterns = [
    path('', include(router.urls)),
]
