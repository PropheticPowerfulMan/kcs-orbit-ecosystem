const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const env = Object.fromEntries(fs.readFileSync("/run/academy-credentials.env","utf8").trim().split(/\n/).map(line=>line.split(/=(.*)/s).slice(0,2)));
const prisma = new PrismaClient();
(async()=>{for(const key of ["TEACHER","ADMIN","SUPER_ADMIN"]){const email=env[key+"_EMAIL"];const passwordHash=await bcrypt.hash(env[key+"_PASSWORD"],12);await prisma.user.upsert({where:{email},update:{fullName:env[key+"_NAME"],passwordHash,role:key,organizationId:process.env.ACADEMY_ORGANIZATION_ID},create:{id:env[key+"_ORBIT_ID"],email,fullName:env[key+"_NAME"],passwordHash,role:key,organizationId:process.env.ACADEMY_ORGANIZATION_ID}})} console.log("ORBIT_ACADEMY_USERS=3");})().finally(()=>prisma.$disconnect());
