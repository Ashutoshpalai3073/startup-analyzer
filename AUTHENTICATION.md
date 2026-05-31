# Authentication System Documentation

## Overview

This document describes the authentication system implemented for Startup Analyzer v2. The system supports:

- **Sign Up** with email verification via OTP
- **Sign In** with OTP verification
- **Logout** functionality
- **JWT-based session management**
- **User profile display** in navbar

## Architecture

### Backend (FastAPI)

#### Database Models
- **User**: Stores user information (email, name, google_id, timestamps)
- **OTPRecord**: Stores OTP codes with expiration times

#### Authentication Flow

1. **Sign Up Flow**:
   - User provides email and name
   - POST `/auth/signup` - Server generates OTP and sends via email
   - User receives OTP in email inbox
   - User enters OTP
   - POST `/auth/verify-otp` - Server verifies OTP and returns JWT token

2. **Sign In Flow**:
   - User provides email
   - POST `/auth/signin` - Server generates OTP and sends via email
   - User receives OTP in email inbox
   - User enters OTP
   - POST `/auth/verify-otp` - Server verifies OTP and returns JWT token

3. **Token Verification**:
   - POST `/auth/verify-token` - Validates JWT token on page load
   - Returns user info if valid, otherwise clears token

4. **Logout**:
   - POST `/auth/logout` - Server acknowledges logout
   - Client clears localStorage token

### Frontend (React)

#### Components

1. **AuthContext** (`src/context/AuthContext.jsx`):
   - Provides authentication state globally
   - Manages user data and JWT token
   - Handles API calls for signup, signin, OTP verification
   - Methods:
     - `signup(email, name)`
     - `signin(email)`
     - `verifyOTP(email, otp_code)`
     - `logout()`

2. **SignUp Component** (`src/components/SignUp.jsx`):
   - Two-step form: email/name → OTP entry
   - Sends OTP to email
   - Verifies OTP and creates account
   - Matches design patterns (dark theme, indigo/purple gradient, glass-morphism)

3. **SignIn Component** (`src/components/SignIn.jsx`):
   - Two-step form: email → OTP entry
   - Sends OTP to email
   - Verifies OTP and signs user in
   - Same design as SignUp

4. **Updated LandingPage** (`src/components/LandingPage.jsx`):
   - Shows user profile dropdown in navbar
   - Displays username and email
   - Logout button in dropdown menu

5. **Updated Dashboard** (`src/components/Dashboard.jsx`):
   - Shows user profile dropdown in navbar
   - Same logout functionality
   - Compact UI on mobile

#### State Management

Auth state is persisted in:
- localStorage: JWT token (`auth_token`)
- Context: User object, authentication status

Token is automatically verified on page load and checked on route changes.

## API Endpoints

### Authentication Endpoints

```
POST /auth/signup
Body: { email: string, name: string }
Response: { status: string, message: string, email: string, name: string }

POST /auth/signin
Body: { email: string }
Response: { status: string, message: string, email: string }

POST /auth/verify-otp
Body: { email: string, otp_code: string }
Response: { status: string, token: string, user: { id, email, name } }

POST /auth/verify-token
Body: { token: string }
Response: { status: string, user: { id, email, name } }

POST /auth/logout
Response: { status: string, message: string }
```

## Configuration

### Backend Setup

1. **Install dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Create .env file**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Configure email (Optional)**:
   - For Gmail: Use App Passwords (not regular password)
   - Set `EMAIL_SENDER` and `EMAIL_PASSWORD` in .env
   - If not configured, OTPs print to console

4. **Run server**:
   ```bash
   python main.py
   ```

### Frontend Setup

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Create .env file**:
   ```bash
   cp .env.example .env
   # Update REACT_APP_API_URL if backend is on different host
   ```

3. **Run development server**:
   ```bash
   npm start
   ```

## Security Considerations

1. **OTP Security**:
   - OTPs expire after 10 minutes
   - New OTP invalidates previous ones
   - OTPs are 6 random digits

2. **JWT Security**:
   - Tokens valid for 7 days
   - Stored in localStorage (consider moving to httpOnly cookies for production)
   - Always use HTTPS in production

3. **Password Security**:
   - This system uses passwordless authentication (OTP-based)
   - No passwords stored in database

4. **CORS**:
   - Currently allows all origins (`*`)
   - Update in production to specific domains

## Environment Variables

### Backend (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | - | API key for Groq AI |
| `JWT_SECRET_KEY` | Yes | - | Secret key for JWT signing |
| `EMAIL_SENDER` | No | - | Email for OTP delivery |
| `EMAIL_PASSWORD` | No | - | Email app password |
| `DATABASE_URL` | No | `sqlite:///./startup_analyzer.db` | Database connection URL |
| `HOST` | No | `0.0.0.0` | Server host |
| `PORT` | No | `8000` | Server port |

### Frontend (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REACT_APP_API_URL` | No | `http://localhost:8000` | Backend API URL |

## OTP Email Template

When users receive OTP emails, they'll see:
- Subject: "Your Startup Analyzer Verification Code"
- Body: Indigo-themed email with 6-digit code
- Expiry: 10 minutes

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR,
  google_id VARCHAR UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT NOW(),
  last_login DATETIME
);
```

### OTP Records Table
```sql
CREATE TABLE otp_records (
  id INTEGER PRIMARY KEY,
  email VARCHAR NOT NULL,
  otp_code VARCHAR NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT false,
  expires_at DATETIME NOT NULL
);
```

## Future Enhancements

1. **Google OAuth Integration**:
   - Sign in with Google button
   - Automatic account creation
   - Profile picture support

2. **Password-based Authentication**:
   - Optional password setup
   - Traditional login method

3. **Two-Factor Authentication**:
   - Email verification after login
   - SMS verification option

4. **Session Management**:
   - Multiple device support
   - Concurrent session limits
   - Session history

5. **User Profile**:
   - Edit profile information
   - Change email
   - Delete account

## Troubleshooting

### OTP not received
- Check email spam folder
- Verify `EMAIL_SENDER` and `EMAIL_PASSWORD` are configured
- Check server logs for email sending errors
- In development, OTP prints to console

### Token expired
- User needs to sign in again
- Token lasts 7 days
- On page reload, old token automatically cleared

### CORS errors
- Backend CORS is set to allow all origins
- In production, set specific allowed origins

### Database errors
- Ensure database file has write permissions
- Check if SQLite database is locked
- Delete `startup_analyzer.db` to reset (all users will be lost)

## Testing the Auth System

1. **Start backend**: `python main.py`
2. **Start frontend**: `npm start`
3. **Test Sign Up**: 
   - Enter email and name
   - Check console for OTP (if email not configured)
   - Enter OTP and complete signup
4. **Test Sign In**:
   - Use same email
   - Check console for OTP
   - Enter OTP and sign in
5. **Test Logout**:
   - Click user profile dropdown
   - Click Logout button
   - Verify redirected to auth page

## Production Deployment

### Before Deploying

1. **Change JWT Secret**:
   ```bash
   # Generate secure random string
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
   Set as `JWT_SECRET_KEY`

2. **Update CORS**:
   Change `allow_origins=["*"]` to specific domains

3. **Use HTTPS**:
   All authentication should be over HTTPS

4. **Move token storage**:
   Consider moving from localStorage to httpOnly cookies

5. **Set up database**:
   For production, use PostgreSQL instead of SQLite

6. **Configure email service**:
   Use professional email service like SendGrid or AWS SES

7. **Set up monitoring**:
   Add logging for authentication events
