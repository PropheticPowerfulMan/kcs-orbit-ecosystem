import { canDeleteLesson, canEditLesson, canReviewLesson, canViewLesson, hasPermission } from "../services/permissions";
import { LessonPlan } from "../types/lesson";
import { Permission } from "../types/user";
import { useAuth } from "../contexts/AuthContext";

export const usePermissions = () => {
  const { currentUser } = useAuth();

  return {
    can: (permission: Permission) => hasPermission(currentUser, permission),
    canViewLesson: (lesson: LessonPlan) => canViewLesson(currentUser, lesson),
    canEditLesson: (lesson: LessonPlan) => canEditLesson(currentUser, lesson),
    canDeleteLesson: (lesson: LessonPlan) => canDeleteLesson(currentUser, lesson),
    canReviewLesson: (lesson: LessonPlan) => canReviewLesson(currentUser, lesson)
  };
};
