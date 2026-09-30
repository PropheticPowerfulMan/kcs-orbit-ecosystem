# Modèle de récupération Supabase

1. Dans Supabase, ouvrir Authentication.
2. Ouvrir Email Templates.
3. Sélectionner Reset password ou Change Password.
4. Utiliser le sujet : Réinitialisation de votre mot de passe KCS EduPlanner
5. Coller le contenu de reset-password.html puis enregistrer.
6. Dans Authentication, URL Configuration, définir :
   - Site URL : https://kcseduplanner.kinshasachristianschool.org
   - Redirect URL : https://kcseduplanner.kinshasachristianschool.org/#/login
   - Conserver aussi https://propheticpowerfulman.github.io/LessonPlanPowerfullyDone/#/login

Tant que le sous-domaine VPS n’est pas en ligne, utiliser GitHub Pages comme Site URL ou tester directement depuis GitHub Pages.