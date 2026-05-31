from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from .models import Message, Notification
from .serializers import MessageSerializer, MessageCreateSerializer, NotificationSerializer
from .services import deliver_direct_parent_contact, deliver_parent_communication


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

    def create(self, request, *args, **kwargs):
        recipients = request.data.get('recipients')
        if isinstance(recipients, list) and recipients:
            subject = str(request.data.get('subject') or '').strip()
            body = str(request.data.get('body') or '').strip()
            channels = request.data.get('channels') or ['email', 'sms']
            normalized_channels = [str(channel).lower() for channel in channels if str(channel).lower() in {'email', 'sms'}]

            if not subject:
                return Response({'detail': 'Subject is required.'}, status=status.HTTP_400_BAD_REQUEST)
            if not body:
                return Response({'detail': 'Body is required.'}, status=status.HTTP_400_BAD_REQUEST)
            if not normalized_channels:
                return Response({'detail': 'At least one delivery channel is required.'}, status=status.HTTP_400_BAD_REQUEST)

            sent_at = timezone.now()
            records = []
            for index, recipient in enumerate(recipients):
                if not isinstance(recipient, dict):
                    continue

                name = str(recipient.get('name') or recipient.get('receiver_name') or 'Parent').strip()
                email = str(recipient.get('email') or '').strip()
                phone = str(recipient.get('phone') or '').strip()
                delivery = deliver_direct_parent_contact(
                    name=name,
                    email=email,
                    phone=phone,
                    subject=subject,
                    body=body,
                    channels=normalized_channels,
                )
                records.append({
                    'id': f'direct-{int(sent_at.timestamp())}-{index}',
                    'receiver': recipient.get('id') or recipient.get('receiver') or '',
                    'receiver_name': name,
                    'subject': subject,
                    'body': body,
                    'sent_at': sent_at.isoformat(),
                    'delivery': [result.__dict__ for result in delivery],
                    'parent_message': None,
                    'reply_count': 0,
                })

            return Response({'results': records, 'sentCount': len(records)}, status=status.HTTP_201_CREATED)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        delivery = deliver_parent_communication(
            message.receiver,
            message.subject,
            message.body,
            notif_type=Notification.TYPE_MESSAGE,
            link='/communication',
        )
        output = MessageSerializer(message, context=self.get_serializer_context()).data
        output['delivery'] = [result.__dict__ for result in delivery]
        headers = self.get_success_headers(serializer.data)
        return Response(output, status=status.HTTP_201_CREATED, headers=headers)


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
