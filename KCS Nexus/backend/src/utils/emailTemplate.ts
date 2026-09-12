const LOGO_URL = 'https://kinshasachristianschool.org/icons/nexus-192.png'
const SCHOOL_URL = 'https://kinshasachristianschool.org/'
const FACEBOOK_URL = 'https://www.facebook.com/KinshasaChristianSchool'
const INSTAGRAM_URL = 'https://www.instagram.com/kinshasachristianschoolknights'
const YOUTUBE_URL = 'https://www.youtube.com/@kinshasachristianschool4789'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))
const socialLink = (href: string, label: string, glyph: string, color: string) => `<td style="padding:4px"><a href="${href}" aria-label="${label}" style="display:inline-block;border:1px solid #6f91b8;border-radius:999px;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;white-space:nowrap"><span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:${color};border-radius:999px;color:#ffffff;font-size:10px;font-weight:900">${glyph}</span><span style="display:inline-block;padding:0 10px 0 7px;vertical-align:middle;color:#ffffff">${label}</span></a></td>`

export const kcsBrandedEmailHtml = (subject: string, text: string, suppliedHtml?: string) => {
  const safeSubject = escapeHtml(subject)
  const preview = escapeHtml(text.replace(/\s+/g, ' ').trim().slice(0, 145))
  const content = suppliedHtml?.trim() || text.split(/\r?\n/).map((line) => line.trim() ? `<p style="margin:0 0 16px;line-height:1.75;color:#2b4059">${escapeHtml(line)}</p>` : '<div style="height:12px;line-height:12px">&nbsp;</div>').join('')
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${safeSubject}</title><style>
@media only screen and (max-width:620px){.kcs-shell{padding:12px 6px!important}.kcs-card{border-radius:18px!important}.kcs-header{padding:22px 18px!important}.kcs-body{padding:24px 18px!important}.kcs-title{font-size:23px!important}.kcs-brand-copy{padding-left:13px!important}.kcs-footer{padding:24px 16px!important}.kcs-button{display:block!important;text-align:center!important}}
</style></head>
<body style="margin:0;padding:0;background:#edf3f9;color:#102a4c;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preview}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#edf3f9"><tr><td class="kcs-shell" align="center" style="padding:30px 12px">
<table class="kcs-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;background:#ffffff;border:1px solid #d8e5f2;border-radius:24px;border-collapse:separate;overflow:hidden;box-shadow:0 18px 50px rgba(7,38,75,.14)">
<tr><td style="height:7px;background:#f7c600;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td class="kcs-header" style="padding:28px 30px;background:#063765"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
<td width="72" valign="middle"><a href="${SCHOOL_URL}" style="text-decoration:none"><img src="${LOGO_URL}" width="68" height="68" alt="Logo Kinshasa Christian School" style="display:block;width:68px;height:68px;background:#ffffff;border:3px solid #f7c600;border-radius:50%;object-fit:cover"></a></td>
<td class="kcs-brand-copy" valign="middle" style="padding-left:18px"><div style="margin:0 0 6px;color:#f7c600;font-size:11px;font-weight:800;letter-spacing:1.7px;text-transform:uppercase">KCS · Communication officielle</div><h1 class="kcs-title" style="margin:0;color:#ffffff;font-size:27px;line-height:1.25;font-weight:800">${safeSubject}</h1><div style="margin-top:7px;color:#c7ddf2;font-size:13px;line-height:1.4">Letting Our Light Shine</div></td>
</tr></table></td></tr>
<tr><td class="kcs-body" style="padding:32px 32px 28px;background-color:#ffffff;background-image:linear-gradient(rgba(255,255,255,.94),rgba(255,255,255,.94)),url('${LOGO_URL}');background-position:center;background-repeat:no-repeat;background-size:245px 245px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="padding:0 0 22px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f8fc;border:1px solid #dce8f4;border-left:5px solid #f7c600;border-radius:14px"><tr><td style="padding:15px 17px"><div style="color:#063765;font-size:13px;font-weight:800">Kinshasa Christian School</div><div style="margin-top:5px;color:#5b7088;font-size:12px;line-height:1.55">Message authentique transmis par l’écosystème numérique officiel KCS.</div></td></tr></table></td></tr>
<tr><td style="font-size:15px;line-height:1.75;color:#2b4059">${content}</td></tr>
<tr><td style="padding-top:26px"><a class="kcs-button" href="${SCHOOL_URL}" style="display:inline-block;padding:13px 22px;background:#f7c600;border:1px solid #e6b900;border-radius:999px;color:#082c52;text-decoration:none;font-size:14px;font-weight:800">Ouvrir le portail officiel KCS</a></td></tr>
<tr><td style="padding-top:26px"><div style="height:1px;background:#e1eaf3;font-size:0;line-height:0">&nbsp;</div></td></tr>
<tr><td style="padding-top:18px;color:#6a7d91;font-size:11px;line-height:1.6">Ce message a été envoyé par un service officiel de Kinshasa Christian School. Ne communiquez jamais votre mot de passe ou votre code d’accès par email.</td></tr>
</table></td></tr>
<tr><td class="kcs-footer" align="center" style="padding:25px 24px;background:#082f58"><a href="${SCHOOL_URL}" style="text-decoration:none"><img src="${LOGO_URL}" width="44" height="44" alt="KCS" style="display:inline-block;width:44px;height:44px;background:#ffffff;border:2px solid #f7c600;border-radius:50%;object-fit:cover"></a><div style="margin-top:10px;color:#ffffff;font-size:14px;font-weight:800">Kinshasa Christian School</div><div style="margin-top:5px;color:#b8d0e8;font-size:11px;line-height:1.5">Macampagne, Ngaliema · Kinshasa, RDC</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:17px auto 0"><tr>${socialLink(FACEBOOK_URL, 'Facebook', 'FB', '#1877f2')}${socialLink(INSTAGRAM_URL, 'Instagram', 'IG', '#c13584')}${socialLink(YOUTUBE_URL, 'YouTube', 'YT', '#ff0000')}</tr></table>
<div style="margin-top:15px;color:#91b2d2;font-size:10px;line-height:1.5">© ${new Date().getFullYear()} Kinshasa Christian School · Tous droits réservés</div></td></tr>
</table></td></tr></table></body></html>`
}

export const KCS_EMAIL_BRAND_LINKS = { logo: LOGO_URL, school: SCHOOL_URL, facebook: FACEBOOK_URL, instagram: INSTAGRAM_URL, youtube: YOUTUBE_URL }
