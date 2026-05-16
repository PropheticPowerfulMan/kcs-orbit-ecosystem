from rest_framework import serializers

from .models import EvolutionAlertDelivery, EvolutionEvent


class EvolutionAlertDeliverySerializer(serializers.ModelSerializer):
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)

    class Meta:
        model = EvolutionAlertDelivery
        fields = ['id', 'recipient', 'recipient_name', 'channel', 'status', 'detail', 'created_at']


class EvolutionEventSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='subject_student.full_name', read_only=True)
    actor_name = serializers.CharField(source='actor.get_full_name', read_only=True)
    deliveries = EvolutionAlertDeliverySerializer(many=True, read_only=True)

    class Meta:
        model = EvolutionEvent
        fields = [
            'id', 'entity_type', 'entity_id', 'entity_label', 'event_type', 'severity',
            'title', 'summary', 'metrics', 'snapshot', 'period_start', 'period_end',
            'subject_student', 'student_name', 'actor', 'actor_name', 'alerts_sent',
            'created_at', 'deliveries',
        ]
