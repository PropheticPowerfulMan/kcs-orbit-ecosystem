from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from .models import DirectParentMessage, Message, Notification
from .serializers import MessageSerializer, MessageCreateSerializer, NotificationSerializer
from .services import deliver_direct_parent_contact, deliver_parent_communication, deliver_user_communication


class MessageListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        box = self.request.query_params.get('box', 'inbox')
        queryset = Message.objects.select_related('sender', 'receiver')
        if box == 'sent':
            return queryset.filter(sender=user).order_by('-sent_at')
        if box == 'all':
            return queryset.filter(Q(sender=user) | Q(receiver=user)).order_by('-sent_at')
        return queryset.filter(receiver=user).order_by('-sent_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return MessageCreateSerializer
        return MessageSerializer

    def list(self, request, *args, **kwargs):
        messages = MessageSerializer(self.get_queryset(), many=True, context=self.get_serializer_context()).data
        if request.query_params.get('box', 'inbox') != 'sent':
            return Response(messages)

        direct_messages = DirectParentMessage.objects.filter(sender=request.user)
        direct_rows = [{
            'id': f'direct-{message.pk}',
            'receiver': message.recipient_external_id,
            'receiver_name': message.recipient_name,
            'receiver_email': message.recipient_email,
            'receiver_phone': message.recipient_phone,
            'subject': message.subject,
            'body': message.body,
            'sent_at': message.sent_at.isoformat(),
            'delivery': message.delivery,
            'parent_message': None,
            'reply_count': 0,
        } for message in direct_messages]
        return Response(sorted([*direct_rows, *messages], key=lambda row: row.get('sent_at') or '', reverse=True))

    def create(self, request, *args, **kwargs):
        recipients = request.data.get('recipients')
        if isinstance(recipients, list) and recipients:
            if getattr(request.user, 'role', '') != 'admin' and not request.user.is_staff:
                return Response({'detail': 'Only an administrator can contact parent records directly.'}, status=status.HTTP_403_FORBIDDEN)
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
                delivery_rows = [result.__dict__ for result in delivery]
                direct_message = DirectParentMessage.objects.create(
                    sender=request.user,
                    recipient_external_id=str(recipient.get('id') or recipient.get('receiver') or ''),
                    recipient_name=name,
                    recipient_email=email,
                    recipient_phone=phone,
                    subject=subject,
                    body=body,
                    channels=normalized_channels,
                    delivery=delivery_rows,
                )
                records.append({
                    'id': f'direct-{direct_message.pk}',
                    'receiver': recipient.get('id') or recipient.get('receiver') or '',
                    'receiver_name': name,
                    'subject': subject,
                    'body': body,
                    'sent_at': direct_message.sent_at.isoformat(),
                    'delivery': delivery_rows,
                    'parent_message': None,
                    'reply_count': 0,
                })

            return Response({'results': records, 'sentCount': len(records)}, status=status.HTTP_201_CREATED)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            message = serializer.save()
            Notification.objects.create(user=message.receiver, title=message.subject[:200], body=message.body, notif_type=Notification.TYPE_MESSAGE, link='/communication')
        try:
            delivery = deliver_user_communication(message.receiver, message.subject, message.body, notif_type=Notification.TYPE_MESSAGE, link='/communication', create_notification=False)
            delivery_rows = [result.__dict__ for result in delivery]
        except Exception as exc:
            delivery_rows = [{'channel': 'external', 'status': 'failed', 'detail': str(exc)}]
        output = MessageSerializer(message, context=self.get_serializer_context()).data
        output['delivery'] = delivery_rows
        headers = self.get_success_headers(serializer.data)
        return Response(output, status=status.HTTP_201_CREATED, headers=headers)



@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def message_contacts(request):
    user = request.user
    allowed = [user.ROLE_ADMIN, user.ROLE_EMPLOYEE, user.ROLE_TEACHER] if user.role in {user.ROLE_PARENT, user.ROLE_STUDENT} else [user.ROLE_ADMIN, user.ROLE_EMPLOYEE, user.ROLE_TEACHER, user.ROLE_STUDENT, user.ROLE_PARENT]
    contacts = user.__class__.objects.filter(is_active=True, role__in=allowed).exclude(pk=user.pk).order_by('role','first_name','last_name')
    return Response([{'id': item.pk, 'name': item.get_full_name() or item.username, 'role': item.role, 'email': item.email} for item in contacts])

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
