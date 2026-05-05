from django.urls import path
from .views import FamilyRegistrationView, StudentListCreateView, StudentDetailView

urlpatterns = [
    path('family-registration/', FamilyRegistrationView.as_view(), name='family-registration'),
    path('', StudentListCreateView.as_view(), name='student-list-create'),
    path('<int:pk>/', StudentDetailView.as_view(), name='student-detail'),
]
