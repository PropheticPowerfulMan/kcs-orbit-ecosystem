from django.urls import path

from .views import create_shared_entity_view, shared_directory_view, shared_entity_detail_view


urlpatterns = [
    path('shared-directory/', shared_directory_view, name='shared-directory'),
    path('entities/<str:entity_type>/', create_shared_entity_view, name='create-shared-entity'),
    path('entities/<str:entity_type>/<str:identifier>/', shared_entity_detail_view, name='shared-entity-detail'),
]
