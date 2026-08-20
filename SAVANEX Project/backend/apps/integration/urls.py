from django.urls import path

from .views import authenticate_ecosystem_identity_view, create_shared_entity_view, reset_ecosystem_identity_access_view, shared_directory_view, shared_entity_detail_view


urlpatterns = [
    path('authenticate/', authenticate_ecosystem_identity_view, name='authenticate-ecosystem-identity'),
    path('shared-directory/', shared_directory_view, name='shared-directory'),
    path('entities/<str:entity_type>/', create_shared_entity_view, name='create-shared-entity'),
    path('entities/<str:entity_type>/<str:identifier>/', shared_entity_detail_view, name='shared-entity-detail'),
    path('entities/<str:entity_type>/<str:identifier>/reset-access/', reset_ecosystem_identity_access_view, name='reset-ecosystem-identity-access'),
]
