#!/usr/bin/env bash
set -Eeuo pipefail
source /root/kcs-academy-institutional-credentials.txt
NEXUS=https://api-nexus.kinshasachristianschool.org/api
ACADEMY=https://academy.kinshasachristianschool.org
json_value() { python3 -c 'import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1],{},{"d":d}))' "$1"; }
status() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }
anonymous="$(status -X POST "$NEXUS/academy/launch")"
parent_token="$(docker exec kcs-orbit-production-nexus_api-1 node -e 'console.log(require("jsonwebtoken").sign({sub:"rbac-parent",role:"parent"},process.env.JWT_SECRET,{expiresIn:"2m"}))')"
student_token="$(docker exec kcs-orbit-production-nexus_api-1 node -e 'console.log(require("jsonwebtoken").sign({sub:"rbac-student",role:"student"},process.env.JWT_SECRET,{expiresIn:"2m"}))')"
parent="$(status -X POST -H "Authorization: Bearer $parent_token" "$NEXUS/academy/launch")"
student="$(status -X POST -H "Authorization: Bearer $student_token" "$NEXUS/academy/launch")"
echo "ANONYMOUS=$anonymous PARENT=$parent STUDENT=$student"
for role in TEACHER ADMIN SUPER_ADMIN; do
  email_var="$role"_EMAIL
  password_var="$role"_PASSWORD
  email="${!email_var}"
  password="${!password_var}"
  login="$(curl -fsS -H 'content-type: application/json' -H 'x-kcs-local-auth-only: true' --data "$(printf '{"identifier":"%s","password":"%s"}' "$email" "$password")" "$NEXUS/auth/login")"
  token="$(printf '%s' "$login" | json_value 'd["data"]["token"]')"
  launch="$(curl -fsS -X POST -H "Authorization: Bearer $token" "$NEXUS/academy/launch")"
  url="$(printf '%s' "$launch" | json_value 'd["data"]["url"]')"
  jar="$(mktemp)"
  callback="$(status -c "$jar" -L "$url")"
  session="$(status -b "$jar" "$ACADEMY/api/session")"
  logout="$(status -b "$jar" -c "$jar" -X POST "$ACADEMY/api/auth/logout")"
  after_logout="$(status -b "$jar" "$ACADEMY/api/session")"
  rm -f "$jar"
  echo "$role=ALLOW CALLBACK=$callback SESSION=$session LOGOUT=$logout AFTER_LOGOUT=$after_logout"
done
direct="$(status "$ACADEMY/")"
health="$(status "$ACADEMY/api/health")"
echo "DIRECT=$direct HEALTH=$health"
