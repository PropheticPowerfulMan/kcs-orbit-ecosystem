from datetime import datetime, timedelta
import hashlib
import secrets
import smtplib
from email.message import EmailMessage
from html import escape
from urllib.parse import quote
from fastapi import HTTPException
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, Session
from app.db.base import Base
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User

from app.models.password_reset import PasswordResetToken

def validate_new_password(password: str) -> None:
    if len(password) < 10 or not any(c.islower() for c in password) or not any(c.isupper() for c in password) or not any(c.isdigit() for c in password) or not any(not c.isalnum() for c in password):
        raise HTTPException(status_code=422, detail="Use at least 10 characters including uppercase, lowercase, a number and a symbol")

def send_local_recovery(email: str, token: str) -> None:
    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        raise RuntimeError("EduSync recovery email is not configured")
    link = settings.password_recovery_url.rstrip("/") + "/#resetToken=" + quote(token, safe="")
    message = EmailMessage()
    message["From"] = settings.smtp_from or settings.smtp_user
    message["To"] = email
    message["Subject"] = "KCS EduSync · Password recovery / Récupération du mot de passe"
    message.set_content("KCS EduSync\n\nReset only your EduSync password / Réinitialisez uniquement votre mot de passe EduSync :\n" + link + "\n\nThis link expires in 30 minutes. Other application passwords remain unchanged.\nCe lien expire dans 30 minutes. Les mots de passe des autres applications restent inchangés.")
    message.add_alternative('<div style="font-family:Arial;color:#17384e;max-width:620px;margin:auto"><h1>KCS EduSync</h1><h2>Password recovery · Récupération du mot de passe</h2><p>This link changes only your EduSync password.<br>Ce lien modifie uniquement votre mot de passe EduSync.</p><p><a style="display:inline-block;background:#075b80;color:white;padding:14px 20px;border-radius:12px" href="' + escape(link, quote=True) + '">Reset EduSync password · Réinitialiser</a></p><p>Valid for 30 minutes · Valable pendant 30 minutes.</p><hr><a href="https://kinshasachristianschool.org">Kinshasa Christian School</a></div>', subtype="html")
    connection = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) if settings.smtp_secure else smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
    with connection as smtp:
        if not settings.smtp_secure:
            smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)

def request_local_recovery(db: Session, email: str) -> None:
    user = db.query(User).filter(User.email.ilike(email)).first()
    if not user:
        return
    now = datetime.utcnow()
    token = secrets.token_urlsafe(32)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)).update({"used_at": now})
    db.add(PasswordResetToken(id=secrets.token_hex(16), user_id=user.id, token_hash=hashlib.sha256(token.encode()).hexdigest(), expires_at=now + timedelta(minutes=30)))
    db.commit()
    try:
        send_local_recovery(user.email, token)
    except Exception:
        # Do not disclose account existence or reset a password before the owner follows the link.
        pass

def reset_local_password(db: Session, token: str, password: str) -> None:
    validate_new_password(password)
    now = datetime.utcnow()
    item = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == hashlib.sha256(token.encode()).hexdigest()).first()
    if not item or item.used_at or item.expires_at <= now:
        raise HTTPException(status_code=400, detail="Invalid or expired EduSync recovery link")
    claimed = db.query(PasswordResetToken).filter(PasswordResetToken.id == item.id, PasswordResetToken.used_at.is_(None), PasswordResetToken.expires_at > now).update({"used_at": now}, synchronize_session=False)
    if claimed != 1:
        db.rollback()
        raise HTTPException(status_code=400, detail="This EduSync recovery link has already been used")
    user = db.get(User, item.user_id)
    if not user:
        db.rollback()
        raise HTTPException(status_code=400, detail="EduSync account not found")
    from app.core.ecosystem_access import ensure_ecosystem_access
    ensure_ecosystem_access([user.email,user.access_code])
    user.hashed_password = get_password_hash(password)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)).update({"used_at": now})
    db.commit()
