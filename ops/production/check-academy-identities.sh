#!/usr/bin/env bash
set -Eeuo pipefail
echo ORBIT_ROLE_COUNTS
docker exec kcs-orbit-orbit-db psql -U orbit -d orbit_clean -Atc 'SELECT role, count(*) FROM "User" GROUP BY role ORDER BY role;'
echo NEXUS_ROLE_AND_LINK_COUNTS
docker exec kcs-orbit-nexus-db psql -U nexus -d nexus_clean -Atc 'SELECT role, count(*), count("orbitUserId") FROM "User" GROUP BY role ORDER BY role;'
