import type { Request, Response, NextFunction, Router } from 'express';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from './database.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';
import { asyncHandler, success } from '../utils/api.js';
import { internalActor, type Actor } from './policy.js';
import { JuryError, token, digest, safeEqual, publicBase, returnBase, trustedOrigin, cookieToken, sessionCookie, wrapKey, unwrapKey } from './security.js';
export type JuryRequest = Request & {
    jury: Actor;
};
const attempts = new Map<string, {
    count: number;
    expires: number;
}>();
function authLimit(req: Request, res: Response, next: NextFunction) { const now = Date.now(), key = String(req.ip) + '::' + req.path, current = attempts.get(key); if (current && current.expires > now && current.count >= 12) {
    const minutes = Math.max(1, Math.ceil((current.expires - now) / 60000));
    res.set('Retry-After', String(minutes * 60));
    return next(new JuryError('AUTH_RATE_LIMITED', `Too many attempts. Try again in ${minutes} minute(s). / Trop de tentatives. Réessayez dans ${minutes} minute(s).`, 429));
} res.once('finish', () => { if ([400, 401, 403].includes(res.statusCode)) {
    const latest = attempts.get(key);
    const row = latest && latest.expires > now ? latest : { count: 0, expires: now + 900000 };
    if (!attempts.has(key) && attempts.size >= 5000)
        attempts.delete(attempts.keys().next().value!);
    row.count++;
    attempts.set(key, row);
} if (attempts.size > 5000)
    for (const [k, v] of attempts)
        if (v.expires < now)
            attempts.delete(k); }); next(); }
export async function canEnter(actor: Actor) { if (actor.academic || actor.teacher || actor.studentId || actor.user?.role === 'PARENT')
    return true; return Boolean(actor.userId && await prisma.juryMember.findFirst({ where: { userId: actor.userId, status: { in: ['INVITED', 'ACCEPTED'] } } })); }
async function launchActor(req: AuthenticatedRequest) { const id = req.user!.sub === 'configured-superadmin' ? (await prisma.user.findUnique({ where: { email: (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase() }, select: { id: true } }))?.id : req.user!.sub; if (!id)
    throw new JuryError('ACCOUNT_UNAVAILABLE', 'The canonical institutional identity could not be found.', 403); const actor = await internalActor(id); if (!await canEnter(actor))
    throw new JuryError('JURY_ACCESS_NOT_ASSIGNED', 'No Jury role, project or evaluation is assigned to this account.', 403); return actor; }
function requireOrigin(req: Request) { if (!trustedOrigin(req.header('origin')))
    throw new JuryError('ORIGIN_NOT_ALLOWED', 'This operation must originate from the institutional application.', 403); }
function actorView(a: Actor) { return { reference: a.reference, name: a.user?.displayName || [a.user?.lastName, a.user?.middleName, a.user?.firstName].filter(Boolean).join(' ') || 'External judge', avatar: a.userId && typeof a.user?.avatar === 'string' && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/s.test(a.user.avatar) ? (()=>{const image=new URL('api/session/portrait',publicBase());image.searchParams.set('actor',a.reference);image.searchParams.set('v',digest(a.user.avatar!).slice(0,20));return image.href})() : null, userId: a.userId, memberId: a.memberId, studentId: a.studentId, roles: { superAdministrator: a.root, administrator: a.administrator, academicAdministrator: a.academic, teacher: a.teacher, student: Boolean(a.studentId), parent: a.user?.role === 'PARENT', externalJudge: Boolean(a.invitationId) }, csrfToken: a.csrfToken, nexusUrl: returnBase(), serverUtc: new Date().toISOString(), environment: process.env.JURY_ENVIRONMENT || 'staging', offlineDraftsConfigured: Boolean(process.env.JURY_DRAFT_MASTER_KEY) }; }
async function guestActor(invitationId: string): Promise<Actor> { const invitation = await prisma.juryInvitation.findUnique({ where: { id: invitationId }, include: { juryMember_invitation: true } }); const member = invitation?.juryMember_invitation.find(m => m.status === 'ACCEPTED'); if (!invitation || !member || invitation.revokedAt || invitation.expiresAt <= new Date())
    throw new JuryError('INVITATION_EXPIRED', 'This temporary Jury access has expired or been revoked.', 403); return { reference: 'guest:' + member.id, userId: null, invitationId, memberId: member.id, root: false, administrator: false, academic: false, teacher: false, studentId: null, sessionId: '', csrfToken: '', user: { displayName: invitation.displayName } }; }
export async function authenticateJury(req: Request, res: Response, next: NextFunction) { try {
    const raw = cookieToken(req.header('cookie'));
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw))
        throw new JuryError('SESSION_REQUIRED', 'Sign in through KCS Nexus or use your assigned Jury invitation.', 401);
    const session = await prisma.juryAppSession.findUnique({ where: { tokenHash: digest(raw) } });
    if (!session || session.revokedAt || session.expiresAt <= new Date())
        throw new JuryError('SESSION_EXPIRED', 'Your Jury session expired. Reopen the application from Nexus.', 401);
    const actor=session.userId?await internalActor(session.userId):await guestActor(session.invitationId!);
    if (session.userId && (!await canEnter(actor) || actor.user?.passwordChangedAt && actor.user.passwordChangedAt > session.createdAt))
        throw new JuryError('SESSION_REVOKED', 'Your institutional access changed. Reopen Jury from Nexus. / Votre accès institutionnel a changé. Rouvrez Jury depuis Nexus.', 401);
    actor.sessionId = session.id;
    actor.csrfToken = session.csrfToken;
    (req as JuryRequest).jury = actor;
    const expected = req.header('x-jury-actor');
    if (expected && !safeEqual(expected, actor.reference))
        throw new JuryError('ACCOUNT_CHANGED', 'This window belongs to another institutional account. Reload before continuing.', 409);
    if (req.header('origin') && !trustedOrigin(req.header('origin')))
        throw new JuryError('ORIGIN_NOT_ALLOWED', 'This application origin is not authorized.', 403);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        requireOrigin(req);
        if (!safeEqual(req.header('x-jury-csrf') || '', session.csrfToken))
            throw new JuryError('CSRF_VALIDATION_FAILED', 'Refresh the application before submitting this operation.', 403);
    }
    res.set('Cache-Control', 'private, no-store');
    next();
}
catch (error) {
    next(error);
} }
async function createSession(actor: Actor, res: Response, expiresAt: Date) { const raw = token(), session = await prisma.juryAppSession.create({ data: { tokenHash: digest(raw), csrfToken: token(), userId: actor.userId, invitationId: actor.invitationId, expiresAt } }); actor.sessionId = session.id; actor.csrfToken = session.csrfToken; res.setHeader('Set-Cookie', sessionCookie(raw, expiresAt)); return actorView(actor); }
async function inspectLaunch(raw: string) {
 const ticket=await prisma.juryLaunchTicket.findUnique({where:{tokenHash:digest(raw)}});
 if(!ticket||ticket.consumedAt||ticket.expiresAt<=new Date())throw new JuryError('TICKET_EXPIRED','This institutional launch ticket expired or was already used.',401);
 const actor=await internalActor(ticket.userId);
 if(actor.user?.passwordChangedAt&&actor.user.passwordChangedAt>ticket.createdAt)throw new JuryError('TICKET_REVOKED','Reopen Jury from Nexus after changing your password.',401);
 if(!await canEnter(actor))throw new JuryError('JURY_ACCESS_NOT_ASSIGNED','Jury access is not assigned to this identity.',403);
 return {ticket,actor};
}
export function publicAuthRoutes(router: Router) {
    router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
    router.get('/health', asyncHandler(async (_req, res) => { await prisma.$queryRaw `SELECT 1`; return success(res, { status: 'ok', service: 'kcs-nexus-jury', environment: process.env.JURY_ENVIRONMENT || 'staging', serverUtc: new Date().toISOString() }); }));
    router.get('/access', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => { const actor = await launchActor(req); return success(res, { enabled: true, roles: actorView(actor).roles, url: publicBase() }); }));
    router.post('/launch', authLimit, authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => { const actor = await launchActor(req), raw = token(); await prisma.juryLaunchTicket.create({ data: { userId: actor.userId!, tokenHash: digest(raw), expiresAt: new Date(Date.now() + 5 * 60000) } }); const u = new URL(publicBase()); u.hash = '/sso?ticket=' + encodeURIComponent(raw); return success(res, { url: u.href }); }));
    router.post('/session/preview',authLimit,asyncHandler(async(req,res)=>{
      requireOrigin(req);const {ticket:raw}=z.object({ticket:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict().parse(req.body),{ticket,actor}=await inspectLaunch(raw);
      const currentRaw=cookieToken(req.header('cookie'));let currentName:string|null=null;
      if(/^[A-Za-z0-9_-]{43}$/.test(currentRaw)){const session=await prisma.juryAppSession.findUnique({where:{tokenHash:digest(currentRaw)}});if(session&&!session.revokedAt&&session.expiresAt>new Date()&&session.userId&&session.userId!==actor.userId){try{currentName=actorView(await internalActor(session.userId)).name}catch{}}}
      return success(res,{reference:actor.reference,name:actorView(actor).name,currentName,expiresAt:ticket.expiresAt});
    }));
    router.post('/session/exchange',authLimit,asyncHandler(async(req,res)=>{
      requireOrigin(req);const body=z.object({ticket:z.string().regex(/^[A-Za-z0-9_-]{43}$/),confirmedReference:z.string().min(1).max(200)}).strict().parse(req.body),{ticket,actor}=await inspectLaunch(body.ticket);
      if(!safeEqual(body.confirmedReference,actor.reference))throw new JuryError('IDENTITY_CONFIRMATION_REQUIRED','Confirm the displayed account before continuing. / Confirmez le compte affiché avant de continuer.',409);
      const used=await prisma.juryLaunchTicket.updateMany({where:{id:ticket.id,consumedAt:null,expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}});
      if(used.count!==1)throw new JuryError('TICKET_ALREADY_USED','Reopen Jury from Nexus to request a new launch.',401);
      return success(res,await createSession(actor,res,new Date(Date.now()+8*3600000)));
    }));
    router.post('/invitations/exchange',authLimit,asyncHandler(async(req,res)=>{
      requireOrigin(req);const {token:raw}=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict().parse(req.body),invitation=await prisma.juryInvitation.findUnique({where:{tokenHash:digest(raw)},include:{juryMember_invitation:true}});
      if(!invitation||invitation.revokedAt||invitation.expiresAt<=new Date()||invitation.acceptedAt)throw new JuryError('INVITATION_EXPIRED','This invitation expired, was revoked or was already used. Ask the project initiator for a new link. / Cette invitation a expiré, a été révoquée ou utilisée. Demandez un nouveau lien à l’initiateur.',401);
      const used=await prisma.$transaction(async tx=>{const found=await tx.juryInvitation.updateMany({where:{id:invitation.id,acceptedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},data:{acceptedAt:new Date()}});if(found.count!==1)return false;await tx.juryMember.updateMany({where:{invitationId:invitation.id,status:'INVITED'},data:{status:'ACCEPTED'}});return true});
      if(!used)throw new JuryError('INVITATION_ALREADY_USED','This invitation has already been accepted. / Cette invitation a déjà été acceptée.',401);
      const actor=await guestActor(invitation.id);return success(res,await createSession(actor,res,new Date(Math.min(invitation.expiresAt.getTime(),Date.now()+8*3600000))));
    }));
}
export function privateAuthRoutes(router: Router) {
    router.get('/session/portrait',asyncHandler(async(req,res)=>{const actor=(req as JuryRequest).jury;if(typeof req.query.actor!=='string'||!safeEqual(req.query.actor,actor.reference))throw new JuryError('ACCOUNT_CHANGED','Personal portrait identity changed',409);const image=actor.userId?actor.user?.avatar:null,match=typeof image==='string'?image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/):null;res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');if(!match)return res.status(204).end();const bytes=Buffer.from(match[2],'base64');if(bytes.length>1500000)return res.status(204).end();return res.type(match[1]).send(bytes)}));
    router.get('/session', asyncHandler(async (req, res) => success(res, actorView((req as JuryRequest).jury))));
    router.post('/session/logout', asyncHandler(async (req, res) => { const actor = (req as JuryRequest).jury; await prisma.juryAppSession.update({ where: { id: actor.sessionId }, data: { revokedAt: new Date() } }); res.setHeader('Set-Cookie', sessionCookie('', new Date(0))); return success(res, { signedOut: true }); }));
    router.post('/session/draft-key', asyncHandler(async (req, res) => { const actor = (req as JuryRequest).jury, { deviceId } = z.object({ deviceId: z.string().uuid() }).strict().parse(req.body); let row = await prisma.juryDraftKey.findFirst({ where: { deviceId, userId: actor.userId, invitationId: actor.invitationId } }); if (row?.revokedAt)
        throw new JuryError('DRAFT_DEVICE_REVOKED', 'Local draft access on this device has been revoked.', 403); if (!row) {
        const bytes = randomBytes(32), wrappedKey = wrapKey(bytes);
        bytes.fill(0);
        try {
            row = await prisma.juryDraftKey.create({ data: { deviceId, userId: actor.userId, invitationId: actor.invitationId, wrappedKey } });
        }
        catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'))
                throw error;
            row = await prisma.juryDraftKey.findFirstOrThrow({ where: { deviceId, userId: actor.userId, invitationId: actor.invitationId } });
        }
    } if (row.revokedAt)
        throw new JuryError('DRAFT_DEVICE_REVOKED', 'Local draft access on this device has been revoked.', 403); const bytes = unwrapKey(row.wrappedKey), key = bytes.toString('base64'); bytes.fill(0); return success(res, { key, deviceId, owner: actor.reference, policy: 'ENCRYPTED_DEVICE_DRAFTS_REQUIRE_ONLINE_UNLOCK_AFTER_COLD_START' }); }));
}
