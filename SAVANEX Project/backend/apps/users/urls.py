from django.urls import path
from . import views

urlpatterns = [
    path('me/', views.UserMeView.as_view(), name='user-me'),
    path('', views.UserListCreateView.as_view(), name='user-list'),
    path('<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('change-password/', views.change_password, name='change-password'),
]
