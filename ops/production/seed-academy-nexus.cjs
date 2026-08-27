const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const env = Object.fromEntries(fs.readFileSync("/run/academy-credentials.env","utf8").trim().split(/\n/).map(line=>line.split(/=(.*)/s).slice(0,2)));
const prisma = new PrismaClient();
(async()=>{for(const key of ["TEACHER","ADMIN","SUPER_ADMIN"]){const email=env[key+"_EMAIL"];const passwordHash=await bcrypt.hash(env[key+"_PASSWORD"],12);const role=key==="TEACHER"?"TEACHER":"ADMIN";await prisma.user.upsert({where:{email},update:{accessCode:env[key+"_ACCESS_CODE"],passwordHash,firstName:"KCS",lastName:env[key+"_NAME"],role,permissions:["academy:access"],orbitUserId:env[key+"_ORBIT_ID"],orbitOrganizationId:process.env.KCS_ORBIT_ORGANIZATION_ID},create:{email,accessCode:env[key+"_ACCESS_CODE"],passwordHash,firstName:"KCS",lastName:env[key+"_NAME"],role,permissions:["academy:access"],orbitUserId:env[key+"_ORBIT_ID"],orbitOrganizationId:process.env.KCS_ORBIT_ORGANIZATION_ID}})} console.log("NEXUS_ACADEMY_USERS=3");})().finally(()=>prisma.$disconnect());
