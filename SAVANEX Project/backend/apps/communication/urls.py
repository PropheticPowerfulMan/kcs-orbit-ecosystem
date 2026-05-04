from django.urls import path
from .views import (
    MessageListCreateView,
    MessageDetailView,
    mark_message_read,
    NotificationListView,
    mark_notification_read,
)

urlpatterns = [
    path('messages/', MessageListCreateView.as_view(), name='message-list-create'),
    path('messages/<int:pk>/', MessageDetailView.as_view(), name='message-detail'),
    path('messages/<int:pk>/read/', mark_message_read, name='message-read'),
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:pk>/read/', mark_notification_read, name='notification-read'),
]
