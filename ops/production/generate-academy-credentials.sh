#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
file=/root/kcs-academy-institutional-credentials.txt
cat > "$file" <<EOF
TEACHER_EMAIL=academy.teacher@kinshasachristianschool.org
TEACHER_ACCESS_CODE=KCS-ACADEMY-TEACHER
TEACHER_NAME=AcademyTeacher
TEACHER_ORBIT_ID=$(cat /proc/sys/kernel/random/uuid)
TEACHER_PASSWORD=Kcs!$(openssl rand -hex 12)
ADMIN_EMAIL=academy.admin@kinshasachristianschool.org
ADMIN_ACCESS_CODE=KCS-ACADEMY-ADMIN
ADMIN_NAME=AcademyAdministrator
ADMIN_ORBIT_ID=$(cat /proc/sys/kernel/random/uuid)
ADMIN_PASSWORD=Kcs!$(openssl rand -hex 12)
SUPER_ADMIN_EMAIL=academy.superadmin@kinshasachristianschool.org
SUPER_ADMIN_ACCESS_CODE=KCS-ACADEMY-SUPERADMIN
SUPER_ADMIN_NAME=AcademySuperAdministrator
SUPER_ADMIN_ORBIT_ID=$(cat /proc/sys/kernel/random/uuid)
SUPER_ADMIN_PASSWORD=Kcs!$(openssl rand -hex 12)
EOF
chmod 600 "$file"
echo CREDENTIAL_FILE_CREATED
