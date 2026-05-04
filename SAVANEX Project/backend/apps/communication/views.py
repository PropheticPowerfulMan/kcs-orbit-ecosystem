from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Message, Notification
from .serializers import MessageSerializer, MessageCreateSerializer, NotificationSerializer


class MessageListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        box = self.request.query_params.get('box', 'inbox')
        if box == 'sent':
            return Message.objects.filter(sender=user).select_related('sender', 'receiver').order_by('-sent_at')
        return Message.objects.filter(receiver=user).select_related('sender', 'receiver').order_by('-sent_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return MessageCreateSerializer
        return MessageSerializer


class MessageDetailView(generics.RetrieveAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Message.objects.filter(sender=user) | Message.objects.filter(receiver=user)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_message_read(request, pk):
    try:
        message = Message.objects.get(pk=pk, receiver=request.user)
    except Message.DoesNotExist:
        return Response({'detail': 'Message not found.'}, status=404)

    message.mark_as_read()
    return Response({'detail': 'Message marked as read.'})


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_notification_read(request, pk):
    try:
        notif = Notification.objects.get(pk=pk, user=request.user)
    except Notification.DoesNotExist:
        return Response({'detail': 'Notification not found.'}, status=404)

    notif.is_read = True
    notif.save(update_fields=['is_read'])
    return Response({'detail': 'Notification marked as read.'})
