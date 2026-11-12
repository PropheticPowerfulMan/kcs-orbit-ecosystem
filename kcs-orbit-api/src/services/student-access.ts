import { prisma } from '../db';
const inactive = (status: unknown) => ['GRADUATED','ARCHIVED','DISMISSED', 'EXPELLED','DELETED','INACTIVE'].includes(String(status ?? '').trim().toUpperCase());
export async function identityAccess(id: string, organizationId: string) {
  const student = await prisma.student.findFirst({where:{id,organizationId},select:{status:true}});
  if (student) return { allowed:!inactive(student.status), kind:'STUDENT', status:student.status };
  const [teacher,parent] = await Promise.all([prisma.teacher.findFirst({where:{id,organizationId},select:{id:true}}), prisma.parent.findFirst({where:{id,organizationId},select:{id:true}})]);
  return { allowed:Boolean(teacher || parent), kind:teacher?'TEACHER':parent?'PARENT':null, status:null };
}
export async function studentUserAccess(userId: string, organizationId?: string | null) {
  const user = await prisma.user.findUnique({where:{id:userId},select:{role:true,email:true,organizationId:true}});
  if (!user || user.organizationId !== organizationId) return false;
  if (user.role !== 'STUDENT') return true;
  if (!organizationId) return false;
  const audit = await prisma.auditLog.findFirst({where:{userId,organizationId,action:'ACADEMY_SERVICE_TICKET_CREATED'},select:{metadata:true},orderBy:[{createdAt:'asc'},{id:'asc'}]});
  const sourceId = (audit?.metadata as Record<string,unknown> | null)?.sourceIdentityId;
  const candidates = typeof sourceId === 'string'
    ? await prisma.student.findMany({where:{id:sourceId,organizationId},select:{status:true},take:2})
    : await prisma.student.findMany({where:{email:{equals:user.email,mode:'insensitive'},organizationId},select:{status:true},take:2});
  const student = candidates.length === 1 ? candidates[0] : null;
  return Boolean(student && !inactive(student.status));
}
