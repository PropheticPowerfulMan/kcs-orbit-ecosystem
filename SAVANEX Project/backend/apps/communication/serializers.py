from rest_framework import serializers
from apps.users.models import User
from .models import Message, Notification


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.get_full_name', read_only=True)
    receiver_name = serializers.CharField(source='receiver.get_full_name', read_only=True)
    reply_count = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'sender', 'sender_name', 'receiver', 'receiver_name',
            'subject', 'body', 'sent_at', 'is_read', 'read_at',
            'parent_message', 'reply_count',
        ]
        read_only_fields = ['id', 'sent_at', 'is_read', 'read_at']

    def get_reply_count(self, obj):
        return obj.replies.count()


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['receiver', 'subject', 'body', 'parent_message']

    def validate_receiver(self, receiver):
        sender = self.context['request'].user
        if receiver.pk == sender.pk:
            raise serializers.ValidationError('You cannot send a message to yourself.')
        if sender.role in {User.ROLE_PARENT, User.ROLE_STUDENT} and receiver.role not in {User.ROLE_ADMIN, User.ROLE_EMPLOYEE, User.ROLE_TEACHER}:
            raise serializers.ValidationError('Parents and students may only contact authorized school staff.')
        if not receiver.is_active:
            raise serializers.ValidationError('This recipient account is inactive.')
        return receiver

    def create(self, validated_data):
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'body', 'notif_type', 'is_read', 'created_at', 'link']
        read_only_fields = ['id', 'created_at']
