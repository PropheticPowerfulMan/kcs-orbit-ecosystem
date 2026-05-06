from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """Allow access only to users with admin role."""
    message = 'Admin access required.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'admin'
        )


class IsTeacherOrAdmin(BasePermission):
    """Allow access to employees, teachers and admins."""
    message = 'Employee, Teacher or Admin access required.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ('employee', 'teacher', 'admin')
        )


class IsOwnerOrAdmin(BasePermission):
    """Allow object access to the owner or admin."""

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        # Check if object has a 'user' attribute (student/teacher profile)
        if hasattr(obj, 'user'):
            return obj.user == request.user
        # For user objects directly
        return obj == request.user
