import React, { useState } from "react";
import { motion } from "framer-motion";
import { useWindowWidth } from "../useWindowWidth";
import { useAuth } from "../context/AuthContext";

const EXAMPLES = [
  "Build your startup idea analysis",
  "Get AI-powered market insights",
  "Create pitch decks instantly",
  "Analyze competitors instantly",
];

function ParticleCanvas() {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      o: Math.random() * 0.5 + 0.1,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${p.o})`;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > w) p.dx *= -1;
        if (p.y < 0 || p.y > h) p.dy *= -1;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}

export default function SignUp({ onSwitchToSignIn }) {
  const width = useWindowWidth();
  const isMobile = width < 640;
  const { signup, verifyOTP } = useAuth();

  const [step, setStep] = useState("signup"); // signup, otp
  const [formData, setFormData] = useState({ email: "", name: "" });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signup(formData.email, formData.name);
      setOtpEmail(formData.email);
      setStep("otp");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await verifyOTP(otpEmail, otp);
      // Redirect to dashboard handled in App.jsx
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050510",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800;900&display=swap');
        @keyframes glow { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
        .auth-input { transition: all 0.3s ease !important; }
        .auth-input:focus { background: rgba(99,102,241,0.1) !important; border-color: rgba(99,102,241,0.5) !important; box-shadow: 0 0 20px rgba(99,102,241,0.3) !important; }
        .auth-btn:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 20px 60px rgba(99,102,241,0.5) !important; }
      `}</style>

      <ParticleCanvas />

      {/* Ambient glows */}
      <div
        style={{
          position: "fixed",
          top: "-20%",
          left: "-10%",
          width: isMobile ? 400 : 700,
          height: isMobile ? 400 : 700,
          background:
            "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 1,
          animation: "glow 4s ease-in-out infinite",
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? "2rem 1rem" : "2rem",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            width: "100%",
            maxWidth: 420,
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "2rem",
              gap: "0.6rem",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
                fontWeight: 800,
                color: "#fff",
                boxShadow: "0 4px 15px rgba(99,102,241,0.4)",
              }}
            >
              ✦
            </div>
            <span
              style={{
                color: "#fff",
                fontWeight: 800,
                fontSize: "1.3rem",
                letterSpacing: "-0.02em",
              }}
            >
              Drusti
            </span>
          </div>

          {/* Form Card */}
          <div
            style={{
              background: "rgba(15,23,42,0.8)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: 16,
              padding: isMobile ? "1.5rem" : "2rem",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <h2
              style={{
                color: "#fff",
                fontSize: isMobile ? "1.3rem" : "1.5rem",
                fontWeight: 700,
                marginBottom: "0.5rem",
                letterSpacing: "-0.01em",
              }}
            >
              {step === "signup" ? "Create Account" : "Verify Email"}
            </h2>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "0.9rem",
                marginBottom: "1.5rem",
              }}
            >
              {step === "signup"
                ? "Join Drusti to analyze your startup idea"
                : "Enter the 6-digit code sent to your email"}
            </p>

            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 8,
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  color: "#fca5a5",
                  fontSize: "0.85rem",
                }}
              >
                {error}
              </div>
            )}

            {step === "signup" ? (
              <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  style={{
                    background: "rgba(30,41,59,0.6)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: 8,
                    padding: "0.75rem 1rem",
                    color: "#f1f5f9",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                  className="auth-input"
                  required
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  style={{
                    background: "rgba(30,41,59,0.6)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: 8,
                    padding: "0.75rem 1rem",
                    color: "#f1f5f9",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                  className="auth-input"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none",
                    borderRadius: 8,
                    padding: "0.75rem 1rem",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    fontSize: "0.95rem",
                    boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
                  }}
                  className="auth-btn"
                >
                  {loading ? "Sending OTP..." : "Sign Up"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                  maxLength="6"
                  style={{
                    background: "rgba(30,41,59,0.6)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: 8,
                    padding: "0.75rem 1rem",
                    color: "#f1f5f9",
                    fontSize: "1.2rem",
                    letterSpacing: "0.2em",
                    outline: "none",
                    textAlign: "center",
                  }}
                  className="auth-input"
                  required
                />
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none",
                    borderRadius: 8,
                    padding: "0.75rem 1rem",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: loading || otp.length !== 6 ? "not-allowed" : "pointer",
                    opacity: loading || otp.length !== 6 ? 0.7 : 1,
                    fontSize: "0.95rem",
                    boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
                  }}
                  className="auth-btn"
                >
                  {loading ? "Verifying..." : "Verify & Sign Up"}
                </button>
              </form>
            )}

            {/* Switch to sign in */}
            <div
              style={{
                marginTop: "1.5rem",
                paddingTop: "1.5rem",
                borderTop: "1px solid rgba(99,102,241,0.1)",
                textAlign: "center",
              }}
            >
              <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                Already have an account?{" "}
              </span>
              <button
                onClick={onSwitchToSignIn}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6366f1",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Sign In
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
