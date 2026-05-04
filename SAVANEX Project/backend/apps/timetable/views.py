from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import TimeSlot
from .serializers import TimeSlotSerializer
from apps.users.permissions import IsTeacherOrAdmin


class TimeSlotViewSet(viewsets.ModelViewSet):
    queryset = TimeSlot.objects.select_related(
        'class_subject__class_instance',
        'class_subject__subject',
        'class_subject__teacher__user',
        'academic_year',
    ).all()
    serializer_class = TimeSlotSerializer
    permission_classes = [IsTeacherOrAdmin]
    filterset_fields = ['academic_year', 'day_of_week', 'class_subject__class_instance']

    @action(detail=False, methods=['get'])
    def conflicts(self, request):
        slots = list(self.get_queryset())
        conflicts = []

        for i in range(len(slots)):
            for j in range(i + 1, len(slots)):
                slot_a = slots[i]
                slot_b = slots[j]

                same_day = slot_a.day_of_week == slot_b.day_of_week
                overlap = slot_a.start_time < slot_b.end_time and slot_b.start_time < slot_a.end_time

                if not (same_day and overlap):
                    continue

                teacher_a = slot_a.class_subject.teacher_id
                teacher_b = slot_b.class_subject.teacher_id
                class_a = slot_a.class_subject.class_instance_id
                class_b = slot_b.class_subject.class_instance_id

                if teacher_a and teacher_a == teacher_b:
                    conflicts.append({
                        'type': 'teacher_conflict',
                        'description': 'Teacher assigned to two sessions at the same time.',
                        'slot_1': TimeSlotSerializer(slot_a).data,
                        'slot_2': TimeSlotSerializer(slot_b).data,
                    })

                if class_a == class_b:
                    conflicts.append({
                        'type': 'class_conflict',
                        'description': 'Class has overlapping sessions.',
                        'slot_1': TimeSlotSerializer(slot_a).data,
                        'slot_2': TimeSlotSerializer(slot_b).data,
                    })

        return Response(conflicts)
