#!/usr/bin/env bash
set -Eeuo pipefail
source /root/kcs-academy-institutional-credentials.txt
jar="$(mktemp)"
body="$(mktemp)"
login_page="$(curl -fsS https://academy.kinshasachristianschool.org/login)"
printf '%s' "$login_page" | grep -q 'KCS Nexus Academy'
printf '%s' "$login_page" | grep -q 'institutional-login'
curl -fsS -L -c "$jar" -b "$jar" --data-urlencode "identifier=$TEACHER_ACCESS_CODE" --data-urlencode "password=$TEACHER_PASSWORD" -o "$body" -w 'FORM_HTTP=%{http_code} FINAL_URL=%{url_effective}\n' https://academy.kinshasachristianschool.org/api/auth/institutional-login
grep -q 'KCS Nexus' "$body"
session="$(curl -sS -o /dev/null -w '%{http_code}' -b "$jar" https://academy.kinshasachristianschool.org/api/session)"
echo "LOGIN_PAGE=PASS FORM_RENDER=PASS TEACHER_SESSION=$session BODY_BYTES=$(wc -c < "$body")"
rm -f "$jar" "$body"
