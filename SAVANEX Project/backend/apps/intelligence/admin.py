from django.contrib import admin

from .models import EvolutionAlertDelivery, EvolutionEvent


@admin.register(EvolutionEvent)
class EvolutionEventAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'entity_label', 'event_type', 'severity', 'title', 'alerts_sent')
    list_filter = ('event_type', 'severity', 'entity_type')
    search_fields = ('entity_label', 'title', 'summary', 'entity_id')
    readonly_fields = ('created_at',)


@admin.register(EvolutionAlertDelivery)
class EvolutionAlertDeliveryAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'event', 'recipient', 'channel', 'status')
    list_filter = ('channel', 'status')
    readonly_fields = ('created_at',)
