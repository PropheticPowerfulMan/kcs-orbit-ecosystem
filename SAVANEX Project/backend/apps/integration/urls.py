from django.urls import path

from .views import document_verification_issue_view, document_verification_view, authenticate_ecosystem_identity_view, create_shared_entity_view, reset_ecosystem_identity_access_view, change_ecosystem_identity_password_view, shared_directory_view, shared_entity_detail_view


urlpatterns = [
    path('document-verification/issue/', document_verification_issue_view, name='document-verification-issue'),
    path('document-verification/<str:token>/', document_verification_view, name='document-verification'),
    path('authenticate/', authenticate_ecosystem_identity_view, name='authenticate-ecosystem-identity'),
    path('shared-directory/', shared_directory_view, name='shared-directory'),
    path('entities/<str:entity_type>/', create_shared_entity_view, name='create-shared-entity'),
    path('entities/<str:entity_type>/<str:identifier>/', shared_entity_detail_view, name='shared-entity-detail'),
    path('entities/<str:entity_type>/<str:identifier>/reset-access/', reset_ecosystem_identity_access_view, name='reset-ecosystem-identity-access'),
    path('entities/<str:entity_type>/<str:identifier>/change-password/', change_ecosystem_identity_password_view, name='change-ecosystem-identity-password'),
]
