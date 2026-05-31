import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();
const API = () => process.env.REACT_APP_API_URL || "http://localhost:8000";

export const AuthProvider = ({ children }) => {
  // Initialise user from localStorage so the name shows immediately on page load
  // (before verify-token round-trip completes)
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("auth_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken]     = useState(localStorage.getItem("auth_token"));
  const [loading, setLoading] = useState(true);

  // On mount: handle Google OAuth callback first, then verify any stored token
  useEffect(() => {
    const path   = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    if (path === "/auth/google/callback") {
      const googleToken = params.get("token");
      const googleError = params.get("error");
      // Clean the URL so the user never sees the token in the address bar
      window.history.replaceState({}, "", "/");

      if (googleToken) {
        verifyGoogleToken(googleToken);
      } else {
        if (googleError === "otp_conflict") {
          // Surface this via localStorage so App.jsx can pick it up if needed
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
        _clearSession();
      }
    } catch {
      _clearSession();
    } finally {
      setLoading(false);
    }
  };

  const verifyStoredToken = async () => {
    try {
      const res = await fetch(`${API()}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("auth_user", JSON.stringify(data));
        setUser(data);
      } else {
        _clearSession();
      }
    } catch {
      _clearSession();
    } finally {
      setLoading(false);
    }
  };

  const _clearSession = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
  };

  // ── Sign Up ───────────────────────────────────────────────────────
  const signup = async (email, name) => {
    const res = await fetch(`${API()}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    if (!res.ok) {
      const err = await res.json();
      const error = new Error(err.detail || "Sign up failed");
      error.status = res.status; // attach HTTP status so callers can detect 409 (Case A)
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
  const deleteAccount = async () => {
    const currentToken = localStorage.getItem("auth_token");
    try {
      await fetch(`${API()}/auth/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`,
        },
      });
    } catch (err) {
      console.error("Delete account error:", err);
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
