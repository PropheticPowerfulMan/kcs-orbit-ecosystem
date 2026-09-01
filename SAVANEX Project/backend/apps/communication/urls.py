from django.urls import path
from .views import (
    MessageListCreateView,
    MessageDetailView,
    mark_message_read,
    message_contacts,
    bulk_delete_messages,
    NotificationListView,
    mark_notification_read,
)

urlpatterns = [
    path('messages/', MessageListCreateView.as_view(), name='message-list-create'),
    path('messages/contacts/', message_contacts, name='message-contacts'),
    path('messages/bulk-delete/', bulk_delete_messages, name='message-bulk-delete'),
    path('messages/<int:pk>/', MessageDetailView.as_view(), name='message-detail'),
    path('messages/<int:pk>/read/', mark_message_read, name='message-read'),
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:pk>/read/', mark_notification_read, name='notification-read'),
]
