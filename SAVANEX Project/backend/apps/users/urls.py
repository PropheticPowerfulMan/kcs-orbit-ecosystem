from django.urls import path
from . import views

urlpatterns = [
    path('me/', views.UserMeView.as_view(), name='user-me'),
    path('', views.UserListCreateView.as_view(), name='user-list'),
    path('<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('<int:pk>/reset-access/', views.reset_user_access, name='user-reset-access'),
    path('<int:pk>/institutional-email/', views.update_institutional_email, name='user-institutional-email'),
    path('reset-access/<str:entity_type>/<str:identifier>/', views.reset_entity_access, name='entity-reset-access'),
    path('change-password/', views.change_password, name='change-password'),
]
