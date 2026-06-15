from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
import os
import json
import secrets
from datetime import datetime
from urllib.parse import urlencode
from dotenv import load_dotenv
from agents import run_analysis
from pitch_generator import generate_pitch_deck
from database import get_db, User, OTPRecord, SavedAnalysis
from sqlalchemy.orm import Session
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import requests as http_requests
from auth import (
    create_access_token,
    verify_token,
    create_otp_record,
    verify_otp,
    create_user,
    create_google_user,
    get_user_by_email,
    get_user_by_google_id,
    update_last_login,
    delete_account_data,
)

load_dotenv()

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL          = os.getenv("BACKEND_URL", "http://localhost:8000")
_state_signer        = URLSafeTimedSerializer(
    os.getenv("JWT_SECRET_KEY", "drusti-jwt-secret-change-in-prod")
)

app = FastAPI(title="Drusti — Startup Analyzer API")

# ─── CORS ─────────────────────────────────────────────────────────────
# FIX: allow_origins=["*"] together with allow_credentials=True is invalid
# per the CORS spec (browsers reject the combination) and exposes the API to
# any origin. Lock to the known frontend origins instead. Extra origins can be
# added via the CORS_EXTRA_ORIGINS env var (comma-separated).
_allowed_origins = {
    FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:5173",
    "https://drusti.vercel.app",
}
for extra in os.getenv("CORS_EXTRA_ORIGINS", "").split(","):
    extra = extra.strip()
    if extra:
        _allowed_origins.add(extra)

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(_allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_IDEA_LENGTH = 600  # characters — guards against prompt-bloating essays


# ─── Viability Score ──────────────────────────────────────────────────
def calculate_viability_score(analysis: dict) -> dict:
    breakdown = {}

    market   = analysis.get("market", {})
    tam      = (market.get("tam") or {}).get("value", 0) or 0
    cagr     = market.get("cagr", 0) or 0
    som      = (market.get("som") or {}).get("value", 0) or 0
    tam_pts  = 15 if tam >= 100 else 12 if tam >= 50 else 9 if tam >= 10 else 6 if tam >= 1 else 3
    cagr_pts = 10 if cagr >= 25 else 8 if cagr >= 15 else 6 if cagr >= 8 else 4 if cagr >= 3 else 2
    som_pts  = 5 if som >= 0.5 else 3 if som >= 0.1 else 1
    breakdown["market"] = {"score": tam_pts + cagr_pts + som_pts, "max": 30, "label": "Market Opportunity"}

    competitors = analysis.get("competitors", {})
    landscape   = (competitors.get("landscape_type") or "").lower()
    gaps        = competitors.get("gaps", [])
    land_pts = 20 if "blue" in landscape else 15 if "purple" in landscape or "emerging" in landscape else 10 if "fragmented" in landscape else 7 if "consolidated" in landscape else 5
    gap_pts  = min(5, len(gaps) * 2)
    breakdown["competition"] = {"score": land_pts + gap_pts, "max": 25, "label": "Competitive Position"}

    funding   = analysis.get("funding", {})
    sentiment = (funding.get("sentiment") or "").lower()
    fund_pts  = 20 if "very active" in sentiment else 16 if "active" in sentiment else 12 if "growing" in sentiment else 8 if "moderate" in sentiment else 5 if "cautious" in sentiment else 8
    breakdown["funding"] = {"score": fund_pts, "max": 20, "label": "Funding Climate"}

    gtm      = analysis.get("gtm", {})
    channels = gtm.get("channels", [])
    phases   = gtm.get("phases", [])
    icp      = gtm.get("icp", {})
    gtm_pts  = min(15, len(channels) * 5) + min(8, len(phases) * 2) + (2 if icp and icp.get("company_size") else 0)
    breakdown["gtm"] = {"score": gtm_pts, "max": 25, "label": "GTM Clarity"}

    total = min(100, sum(v["score"] for v in breakdown.values()))
    if total >= 80:   label, color = "Excellent",   "#10b981"
    elif total >= 65: label, color = "Strong",      "#3b82f6"
    elif total >= 50: label, color = "Promising",   "#f59e0b"
    elif total >= 35: label, color = "Challenging", "#f97316"
    else:             label, color = "High Risk",   "#ef4444"

    return {"total": total, "max": 100, "label": label, "color": color, "breakdown": breakdown}


# ─── Auth helper ──────────────────────────────────────────────────────
def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    email = verify_token(token)
    user  = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found. Please sign up first.")
    return user


# ─── Request models ───────────────────────────────────────────────────
class SignUpRequest(BaseModel):
    email: str
    name: str

class LoginRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp_code: str

class VerifyTokenRequest(BaseModel):
    token: str

class AnalyzeRequest(BaseModel):
    startup_idea: str

class PitchRequest(BaseModel):
    analysis: dict
    brand_name: str = "Your Brand"


# ─── Auth endpoints ───────────────────────────────────────────────────

def _name_taken(db: Session, name: str, exclude_email: str = None) -> bool:
    """
    Return True if `name` is already claimed — either by a confirmed user
    OR by a pending (unverified, unexpired) OTP sign-up from a different email.
    Case-insensitive.
    """
    name_lower = name.strip().lower()

    # Confirmed users
    for u in db.query(User).all():
        if u.name.strip().lower() == name_lower:
            if exclude_email and u.email == exclude_email:
                continue
            return True

    # Pending sign-ups (OTP sent but not yet verified)
    pending = (
        db.query(OTPRecord)
        .filter(
            OTPRecord.is_verified == False,
            OTPRecord.expires_at > datetime.utcnow(),
            OTPRecord.name != None,
        )
        .all()
    )
    for r in pending:
        if r.name and r.name.strip().lower() == name_lower:
            if exclude_email and r.email == exclude_email:
                continue
            return True

    return False


@app.post("/auth/signup")
async def signup(request: SignUpRequest, db: Session = Depends(get_db)):
    """
    Sign Up: validate (email, name) pair uniqueness, then send OTP.
    The user record is NOT created until OTP is verified.
    """
    try:
        email = request.email.lower().strip()
        name  = request.name.strip()

        # ── Check email ──────────────────────────────────────────────
        existing_by_email = db.query(User).filter(User.email == email).first()
        if existing_by_email:
            if getattr(existing_by_email, "auth_method", "otp") == "google":
                raise HTTPException(
                    status_code=400,
                    detail="This email is already registered with Google login. Please use Google to log in.",
                )
            if existing_by_email.name.strip().lower() == name.lower():
                # Case A — exact pair already in DB → send 409 so frontend shows "Log In" redirect
                raise HTTPException(
                    status_code=409,
                    detail="You're already registered. Log in to continue."
                )
            # Case B — email exists but different name
            raise HTTPException(
                status_code=400,
                detail="This email is already registered under a different name."
            )

        # Also check if this email has a pending sign-up with a different name
        pending_same_email = (
            db.query(OTPRecord)
            .filter(
                OTPRecord.email == email,
                OTPRecord.is_verified == False,
                OTPRecord.expires_at > datetime.utcnow(),
                OTPRecord.name != None,
            )
            .first()
        )
        if pending_same_email and pending_same_email.name.strip().lower() != name.lower():
            raise HTTPException(
                status_code=400,
                detail="This email is already registered under a different name."
            )

        # ── Check name ───────────────────────────────────────────────
        if _name_taken(db, name, exclude_email=email):
            raise HTTPException(
                status_code=400,
                detail="This name is already taken by another account."
            )

        # Validation passed — send OTP (user created only after OTP verified)
        record, email_sent, email_error = create_otp_record(db, email, name)

        if not email_sent:
            # Clean up the pending OTP record so the user can try again
            from database import OTPRecord as OTPRec
            db.query(OTPRec).filter(OTPRec.email == email).delete()
            db.commit()
            raise HTTPException(
                status_code=503,
                detail=f"Could not send OTP to {email}. Please check the email address and try again."
            )

        return {"status": "success", "message": "OTP sent to your email", "email": email, "name": name}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auth/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Log In: email must already exist in the database.
    If it doesn't exist → user has never signed up (or was deleted on log out).
    """
    try:
        email = request.email.lower().strip()

        user = get_user_by_email(db, email)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found. Please sign up first."
            )

        if getattr(user, "auth_method", "otp") == "google":
            raise HTTPException(
                status_code=400,
                detail="This email is registered with Google login. Please use the Google button to log in.",
            )

        record, email_sent, email_error = create_otp_record(db, email)

        if not email_sent:
            raise HTTPException(
                status_code=503,
                detail=f"Could not send OTP to {email}. Please check the email address and try again."
            )

        return {"status": "success", "message": "OTP sent to your email", "email": email}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auth/verify-otp")
async def verify_otp_endpoint(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Verify OTP. For sign up: creates the user. For log in: updates last_login.
    Issues JWT on success.
    """
    try:
        email = request.email.lower().strip()

        verify_otp(db, email, request.otp_code)

        # Does user already exist? (log-in flow) or create them now (sign-up flow)
        user = get_user_by_email(db, email)
        if user:
            update_last_login(db, user)
        else:
            # Fetch name stored in the OTP record during sign up
            from database import OTPRecord
            otp_record = (
                db.query(OTPRecord)
                .filter(OTPRecord.email == email)
                .order_by(OTPRecord.created_at.desc())
                .first()
            )
            name = (otp_record.name or "") if otp_record else ""
            user = create_user(db, email, name)

        token = create_access_token(
            data={"email": user.email, "name": user.name, "user_id": user.id}
        )
        return {
            "status": "success",
            "token":  token,
            "user":   {"id": user.id, "email": user.email, "name": user.name},
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auth/verify-token")
async def verify_token_endpoint(request: VerifyTokenRequest, db: Session = Depends(get_db)):
    """Check if a JWT is still valid and the user still exists."""
    try:
        email = verify_token(request.token)
        user  = get_user_by_email(db, email)
        if not user:
            raise HTTPException(status_code=401, detail="User not found. Please sign up first.")
        return {
            "status": "success",
            "user": {
                "id":          user.id,
                "email":       user.email,
                "name":        user.name,
                "google_id":   user.google_id,
                "auth_method": getattr(user, "auth_method", "otp"),
                "avatar_url":  getattr(user, "avatar_url", None),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auth/logout")
async def logout():
    """
    Log Out: clears the JWT on the client side only.
    The user record and all their data remain in the database.
    They can log back in at any time with just their email + OTP.
    """
    return {"status": "success", "message": "You've been logged out successfully."}


@app.get("/auth/google")
async def google_login():
    """Redirect the browser to Google's OAuth consent screen."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured on this server.")
    state       = secrets.token_urlsafe(32)
    signed_state = _state_signer.dumps(state)
    params = urlencode({
        "client_id":     GOOGLE_CLIENT_ID,
        "redirect_uri":  f"{BACKEND_URL}/auth/google/callback",
        "response_type": "code",
        "scope":         "openid email profile",
        "state":         signed_state,
        "access_type":   "offline",
        "prompt":        "select_account",
    })
    response = RedirectResponse(url=f"https://accounts.google.com/o/oauth2/v2/auth?{params}")
    response.set_cookie(
        key="oauth_state", value=signed_state,
        httponly=True, samesite="lax", max_age=600, secure=False,
    )
    return response


@app.get("/auth/google/callback")
async def google_callback(
    request: Request,
    code:  str = None,
    state: str = None,
    error: str = None,
    db: Session = Depends(get_db),
):
    """Handle Google's redirect, issue a JWT, send the user back to the frontend."""
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/?error=cancelled")

    # Verify CSRF state
    cookie_state = request.cookies.get("oauth_state")
    if not cookie_state or cookie_state != state:
        return RedirectResponse(f"{FRONTEND_URL}/?error=invalid_state")
    try:
        _state_signer.loads(state, max_age=600)
    except (BadSignature, SignatureExpired):
        return RedirectResponse(f"{FRONTEND_URL}/?error=expired_state")

    # Exchange code for access token
    token_resp = http_requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code":          code,
            "client_id":     GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri":  f"{BACKEND_URL}/auth/google/callback",
            "grant_type":    "authorization_code",
        },
        timeout=10,
    )
    if token_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/?error=token_exchange_failed")

    access_token = token_resp.json().get("access_token")

    # Fetch Google profile
    info_resp = http_requests.get(
        "https://www.googleapis.com/oauth2/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if info_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/?error=userinfo_failed")

    info       = info_resp.json()
    email      = info.get("email", "")
    google_id  = str(info.get("id", ""))
    name       = info.get("name") or email.split("@")[0]
    avatar_url = info.get("picture")

    # Conflict: email already registered with OTP
    existing = db.query(User).filter(User.email == email).first()
    if existing and getattr(existing, "auth_method", "otp") == "otp":
        return RedirectResponse(f"{FRONTEND_URL}/?error=otp_conflict")

    # Find or create Google user
    user = get_user_by_google_id(db, google_id)
    if user:
        update_last_login(db, user)
        user.avatar_url = avatar_url
        db.commit()
    else:
        user = create_google_user(db, email=email, name=name, google_id=google_id, avatar_url=avatar_url)

    jwt_token = create_access_token(data={
        "email":       user.email,
        "name":        user.name,
        "user_id":     user.id,
        "auth_method": "google",
        "google_id":   user.google_id,
        "avatar_url":  user.avatar_url,
    })

    resp = RedirectResponse(f"{FRONTEND_URL}/?token={jwt_token}")
    resp.delete_cookie("oauth_state")
    return resp


@app.get("/auth/me")
async def get_me(authorization: str = Header(None), db: Session = Depends(get_db)):
    """Return the authenticated user's full profile from the database."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    email = verify_token(token)
    user  = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {
        "id":          user.id,
        "email":       user.email,
        "name":        user.name,
        "google_id":   user.google_id,
        "auth_method": getattr(user, "auth_method", "otp"),
        "avatar_url":  getattr(user, "avatar_url", None),
    }


@app.post("/auth/delete-account")
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete Account: permanently deletes the user record and ALL associated data.
    This is irreversible. The user must sign up again to use the product.
    """
    delete_account_data(db, current_user)
    return {"status": "success", "message": "Account deleted successfully."}


# ─── Core endpoints ───────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Drusti API is running"}


@app.post("/analyze")
async def analyze(
    request: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # FIX: validate the idea before spending any Tavily credit / Groq token
    idea = (request.startup_idea or "").strip()
    if not idea:
        raise HTTPException(status_code=400, detail="Please enter a startup idea.")
    if len(idea) > MAX_IDEA_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Idea is too long (max {MAX_IDEA_LENGTH} characters). Please summarize it.",
        )

    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

    try:
        result = run_analysis(idea, groq_api_key)

        # FIX: move engine-internal flags into a clean meta block for the frontend
        meta = {
            "cached":         bool(result.pop("_cached", False)),
            "cache_age_days": result.pop("_cache_age_days", None),
            "data_quality":   result.get("data_quality", {}),
            "industry":       (result.get("profile") or {}).get("industry", ""),
        }
        result["meta"] = meta

        score = calculate_viability_score(result)
        result["viability_score"] = score

        saved = SavedAnalysis(
            user_id         = current_user.id,
            startup_idea    = idea,
            analysis_json   = json.dumps(result),
            viability_score = score["total"],
        )
        db.add(saved)
        db.commit()
        db.refresh(saved)
        result["analysis_id"] = saved.id
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analyses")
async def list_analyses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(SavedAnalysis)
        .filter(SavedAnalysis.user_id == current_user.id)
        .order_by(SavedAnalysis.created_at.desc())
        .limit(10)
        .all()
    )
    return {
        "analyses": [
            {"id": r.id, "startup_idea": r.startup_idea,
             "viability_score": r.viability_score, "created_at": r.created_at.isoformat()}
            for r in rows
        ]
    }


@app.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(SavedAnalysis).filter(
        SavedAnalysis.id == analysis_id,
        SavedAnalysis.user_id == current_user.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return json.loads(row.analysis_json)


@app.post("/download-pitch")
async def download_pitch(request: PitchRequest):
    try:
        filepath = generate_pitch_deck(request.analysis, request.brand_name)
        return FileResponse(
            filepath,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            filename=f"{request.brand_name.replace(' ', '_')}_pitch_deck.pptx",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)