from rest_framework import serializers
from .models import TimeSlot


class TimeSlotSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)
    subject_name = serializers.CharField(source='class_subject.subject.name', read_only=True)
    class_name = serializers.CharField(source='class_subject.class_instance.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = TimeSlot
        fields = [
            'id', 'class_subject', 'subject_name', 'class_name',
            'teacher_name', 'academic_year',
            'day_of_week', 'day_name',
            'start_time', 'end_time', 'room',
        ]
        read_only_fields = ['id']

    def get_teacher_name(self, obj):
        t = obj.class_subject.teacher
        return t.user.get_full_name() if t else None


class ConflictSerializer(serializers.Serializer):
    type = serializers.CharField()
    description = serializers.CharField()
    slot_1 = TimeSlotSerializer()
    slot_2 = TimeSlotSerializer()
