#!/usr/bin/env bash
set -Eeuo pipefail
echo PERSISTENCE
docker exec kcs-orbit-orbit-db psql -U orbit -d orbit_clean -Atc 'SELECT count(*), count("revokedAt") FROM "AcademySession"; SELECT role, count(*) FROM "User" WHERE role IN ('"'"'TEACHER'"'"','"'"'ADMIN'"'"','"'"'SUPER_ADMIN'"'"') GROUP BY role ORDER BY role;'
docker exec kcs-orbit-nexus-db psql -U nexus -d nexus_clean -Atc 'SELECT count(*), count("orbitUserId") FROM "User" WHERE permissions @> ARRAY['"'"'academy:access'"'"'];'
echo CONTAINERS
docker ps --filter label=com.docker.compose.project=kcs-orbit-production --format '{{.Names}}|{{.Status}}|{{.Image}}'
echo RESOURCES
free -h
df -h /
echo RECENT_ERRORS
for name in kcs-orbit-production-academy-1 kcs-orbit-production-orbit_api-1 kcs-orbit-production-nexus_api-1; do
  count="$(docker logs --since 10m "$name" 2>&1 | grep -Eic 'uncaught|fatal|panic|database error' || true)"
  echo "$name=$count"
done
