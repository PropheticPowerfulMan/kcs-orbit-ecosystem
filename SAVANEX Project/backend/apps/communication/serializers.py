from rest_framework import serializers
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

    def create(self, validated_data):
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'body', 'notif_type', 'is_read', 'created_at', 'link']
        read_only_fields = ['id', 'created_at']
