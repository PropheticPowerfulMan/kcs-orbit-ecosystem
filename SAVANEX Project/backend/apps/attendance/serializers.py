from rest_framework import serializers
from .models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    subject_name = serializers.CharField(source='class_subject.subject.name', read_only=True)
    class_name = serializers.CharField(source='class_subject.class_instance.name', read_only=True)
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            'id', 'student', 'student_name', 'student_id',
            'class_subject', 'subject_name', 'class_name',
            'date', 'status', 'notes',
            'recorded_by', 'recorded_by_name', 'recorded_at',
        ]
        read_only_fields = ['id', 'recorded_at']

    def get_recorded_by_name(self, obj):
        return obj.recorded_by.get_full_name() if obj.recorded_by else None


class BulkAttendanceSerializer(serializers.Serializer):
    """Serializer for bulk attendance entry for an entire class."""
    class_subject = serializers.IntegerField()
    date = serializers.DateField()
    records = serializers.ListField(
        child=serializers.DictField()
    )

    def validate_records(self, records):
        for record in records:
            if 'student' not in record or 'status' not in record:
                raise serializers.ValidationError(
                    "Each record must have 'student' and 'status' fields."
                )
        return records


class AttendanceReportSerializer(serializers.Serializer):
    """Summary report for a student's attendance."""
    student_id = serializers.IntegerField()
    student_name = serializers.CharField()
    total_sessions = serializers.IntegerField()
    present = serializers.IntegerField()
    absent = serializers.IntegerField()
    late = serializers.IntegerField()
    excused = serializers.IntegerField()
    attendance_rate = serializers.FloatField()
    at_risk = serializers.BooleanField()
