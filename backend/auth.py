import os
import random
import string
import jwt
import requests as http_requests
from datetime import datetime, timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session
from database import User, OTPRecord, SavedAnalysis
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ─── JWT ─────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "drusti-jwt-secret-change-in-prod")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10080  # 7 days


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("email")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ─── OTP ─────────────────────────────────────────────────────────────
def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


OTP_HTML = """
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#080820;border:1px solid rgba(99,102,241,0.25);border-radius:14px;padding:2.5rem">
  <div style="text-align:center;margin-bottom:1.5rem">
    <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);font-size:1.6rem;line-height:48px;color:#fff;font-weight:900">✦</div>
    <h2 style="color:#fff;margin:0.75rem 0 0;font-size:1.4rem;font-weight:800;letter-spacing:-0.02em">Drusti Verification</h2>
  </div>
  <p style="color:#94a3b8;font-size:0.95rem;text-align:center;margin-bottom:2rem">Enter this code to continue. It expires in <b style="color:#f1f5f9">10 minutes</b>.</p>
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;padding:1.5rem;text-align:center;margin-bottom:2rem">
    <p style="font-size:2.8rem;font-weight:900;color:#fff;margin:0;letter-spacing:12px">OTP_CODE</p>
  </div>
  <p style="color:#475569;font-size:0.78rem;text-align:center">If you didn't request this, ignore this email.</p>
</div>
"""


def _html_for_otp(otp_code: str) -> str:
    return OTP_HTML.replace("OTP_CODE", otp_code)


def _send_via_resend(to_email: str, otp_code: str, api_key: str):
    sender = os.getenv("EMAIL_SENDER", "otp@drusti.online")
    resp = http_requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "from": f"Drusti <{sender}>",
            "to": [to_email],
            "subject": "Your Drusti Verification Code",
            "html": _html_for_otp(otp_code),
        },
        timeout=10,
    )
    if resp.status_code in (200, 201):
        print(f"[EMAIL] Sent via Resend from {sender} to {to_email}")
        return True, None
    return False, f"Resend API error {resp.status_code}: {resp.text}"


def _send_via_gmail(to_email: str, otp_code: str, sender: str, password: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Drusti Verification Code"
    msg["From"]    = sender
    msg["To"]      = to_email
    msg.attach(MIMEText(_html_for_otp(otp_code), "html"))
    pw = password.replace(" ", "")
    last_err = ""
    for ssl, port in [(True, 465), (False, 587)]:
        try:
            s = smtplib.SMTP_SSL("smtp.gmail.com", port) if ssl else smtplib.SMTP("smtp.gmail.com", port)
            if not ssl:
                s.starttls()
            s.login(sender, pw)
            s.sendmail(sender, to_email, msg.as_string())
            s.quit()
            print(f"[EMAIL] Sent via Gmail port {port} to {to_email}")
            return True, None
        except Exception as e:
            print(f"[EMAIL] Gmail port {port} failed: {e}")
            last_err = str(e)
    return False, last_err


def send_otp_email(email: str, otp_code: str):
    """
    Provider priority: Resend → Gmail SMTP → dev console.
    Returns (success: bool, error: str | None).
    """
    resend_key     = os.getenv("RESEND_API_KEY", "")
    gmail_sender   = os.getenv("EMAIL_SENDER", "")
    gmail_password = os.getenv("EMAIL_PASSWORD", "")

    if resend_key:
        ok, err = _send_via_resend(email, otp_code, resend_key)
        if ok:
            return True, None
        print(f"[EMAIL] Resend failed: {err} — trying Gmail…")

    if gmail_sender and gmail_password:
        ok, err = _send_via_gmail(email, otp_code, gmail_sender, gmail_password)
        if ok:
            return True, None
        print(f"[EMAIL] Gmail failed: {err}")
        return False, err

    # Dev fallback
    print(f"[DEV] OTP for {email}: {otp_code}")
    return True, None


def create_otp_record(db: Session, email: str, name: str = None):
    """Create OTP record and email it. Returns (record, email_sent, error)."""
    otp_code   = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    db.query(OTPRecord).filter(OTPRecord.email == email).delete()
    record = OTPRecord(email=email, otp_code=otp_code, name=name,
                       expires_at=expires_at, is_verified=False)
    db.add(record)
    db.commit()
    db.refresh(record)

    email_sent, error = send_otp_email(email, otp_code)
    return record, email_sent, error


def verify_otp(db: Session, email: str, otp_code: str):
    """Verify a 6-digit OTP. Raises HTTPException on any failure."""
    record = (
        db.query(OTPRecord)
        .filter(OTPRecord.email == email, OTPRecord.is_verified == False)
        .order_by(OTPRecord.created_at.desc())
        .first()
    )
    if not record:
        raise HTTPException(status_code=400, detail="No OTP found for this email.")

    if datetime.utcnow() > record.expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    if record.otp_code != otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP. Please try again.")

    record.is_verified = True
    db.commit()
    return True


def create_user(db: Session, email: str, name: str) -> User:
    """Create a brand-new OTP user after successful OTP verification during sign up."""
    user = User(email=email, name=name, auth_method="otp")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_google_user(db: Session, email: str, name: str, google_id: str, avatar_url: str = None) -> User:
    """Create a new user who signed up via Google OAuth."""
    user = User(
        email=email,
        name=name,
        google_id=google_id,
        auth_method="google",
        avatar_url=avatar_url,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_google_id(db: Session, google_id: str) -> User | None:
    return db.query(User).filter(User.google_id == google_id).first()


def update_last_login(db: Session, user: User) -> User:
    user.last_login = datetime.utcnow()
    db.commit()
    return user


def delete_account_data(db: Session, user: User):
    """
    Delete Account: permanently wipe the user record and ALL associated data.
    Used only by the /auth/delete-account endpoint — NOT by logout.
    Logout only clears the JWT on the client; the DB record is preserved.
    """
    db.query(SavedAnalysis).filter(SavedAnalysis.user_id == user.id).delete()
    db.query(OTPRecord).filter(OTPRecord.email == user.email).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()
