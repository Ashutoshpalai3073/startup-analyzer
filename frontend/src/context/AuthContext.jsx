import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();
const API = () => process.env.REACT_APP_API_URL || "http://localhost:8000";

export const AuthProvider = ({ children }) => {
  // Initialise user from localStorage so the name shows immediately on page load
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("auth_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem("auth_token"));

  // `loading` is only true for the Google OAuth callback, where we don't have
  // user data yet and must wait for /auth/me. For a stored token we already have
  // the user in localStorage (initialised above), so we render immediately and
  // verify the token silently in the background — no spinner needed.
  const [loading, setLoading] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get("token");
  });

  // On mount: handle Google OAuth callback first, then verify any stored token.
  // BUG FIX (Google loop): the old code checked window.location.pathname ===
  // "/auth/google/callback". Most servers don't rewrite deep paths to index.html,
  // so Google's redirect hit a 404 and the React app never loaded. The backend now
  // redirects to /?token=xxx (root path always works), and we detect the token
  // from URL query params here — path-independent.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleToken = params.get("token");
    const googleError = params.get("error");

    if (googleToken || googleError) {
      // Clean the URL so the user never sees the token in the address bar
      window.history.replaceState({}, "", window.location.pathname);

      if (googleToken) {
        verifyGoogleToken(googleToken);
      } else {
        if (googleError === "otp_conflict") {
          localStorage.setItem(
            "auth_error",
            "This email is already registered with OTP login. Please use OTP to log in."
          );
        }
        setLoading(false);
      }
      return;
    }

    // Normal startup — verify any previously stored token
    if (token) {
      verifyStoredToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyGoogleToken = async (googleToken) => {
    try {
      const res = await fetch(`${API()}/auth/me`, {
        headers: { "Authorization": `Bearer ${googleToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("auth_token", googleToken);
        localStorage.setItem("auth_user", JSON.stringify(data));
        setToken(googleToken);
        setUser(data);
      } else {
        console.error("[Google OAuth] /auth/me rejected:", res.status);
        _clearSession();
      }
    } catch (err) {
      console.error("[Google OAuth] network error:", err);
      _clearSession();
    } finally {
      setLoading(false);
    }
  };

  const verifyStoredToken = async () => {
    // Runs silently in the background — never touches `loading` because the UI
    // already rendered with cached localStorage data. Abort after 5 s so an
    // unreachable backend doesn't hold a stale session open indefinitely.
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${API()}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("auth_user", JSON.stringify(data));
        setUser(data);
      } else {
        _clearSession();
      }
    } catch {
      clearTimeout(timeoutId);
      _clearSession();
    }
    // No setLoading here — loading was already false when this function ran.
  };

  const _clearSession = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
  };

  // ── Sign Up ───────────────────────────────────────────────────────
  // BUG FIX (signup 400): wrapped res.json() in try/catch so a non-JSON error
  // response (e.g. HTML 500 page) doesn't mask the real error with an unrelated
  // "SyntaxError: Unexpected token" instead of the backend's detail message.
  const signup = async (email, name) => {
    const res = await fetch(`${API()}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    if (!res.ok) {
      let errDetail = "Sign up failed";
      try {
        const err = await res.json();
        errDetail = err.detail || errDetail;
      } catch {
        // response body was not JSON — keep the generic message
      }
      console.error("[signup] error", res.status, errDetail);
      const error = new Error(errDetail);
      error.status = res.status;
      throw error;
    }
    return res.json();
  };

  // ── Log In ────────────────────────────────────────────────────────
  const login = async (email) => {
    const res = await fetch(`${API()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Log in failed");
    }
    return res.json();
  };

  // ── Verify OTP (shared by sign up and log in) ─────────────────────
  const verifyOTP = async (email, otp_code) => {
    const res = await fetch(`${API()}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp_code }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "OTP verification failed");
    }
    const data = await res.json();
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  // ── Google OAuth: redirect browser to backend OAuth entry point ─────
  const loginWithGoogle = () => {
    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";
    window.location.href = `${apiUrl}/auth/google`;
  };

  // ── Log Out: clears JWT from localStorage only — data stays in DB ───
  const logout = () => {
    _clearSession();
  };

  // ── Delete Account: wipes entire user record from DB ─────────────────
  // BUG FIX (delete 401): prefer the live `token` state over localStorage so
  // the request always carries the current JWT even if localStorage was
  // partially cleared. Added null-guard so we never send "Bearer null".
  const deleteAccount = async () => {
    const currentToken = token || localStorage.getItem("auth_token");
    if (!currentToken) {
      _clearSession();
      return;
    }
    try {
      const res = await fetch(`${API()}/auth/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[deleteAccount] server error:", res.status, err.detail || "");
      }
    } catch (err) {
      console.error("[deleteAccount] network error:", err);
    } finally {
      _clearSession();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token,
        signup,
        login,
        verifyOTP,
        logout,
        deleteAccount,
        loginWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
