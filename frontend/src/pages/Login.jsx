import React, { useState } from "react";
import API from "../services/api";

function Login({ setLoggedIn }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);

  const submit = async () => {
    if (!user.trim() || !pass) {
      alert("Please enter username and password");
      return;
    }
    if (registerMode && pass.length < 8) {
      alert("Use a password with at least 8 characters");
      return;
    }

    try {
      setLoading(true);
      const endpoint = registerMode ? "/register" : "/login";
      const res = await API.post(endpoint, { username: user.trim(), password: pass });

      if (registerMode) {
        if (res.data.status === "success") {
          alert("Account created. Please log in.");
          setRegisterMode(false);
          setPass("");
        } else {
          alert(res.data.message || "Registration failed");
        }
      } else if (res.data.status === "success" && res.data.token) {
        localStorage.setItem("token", res.data.token);
        setLoggedIn(true);
      } else {
        alert("Invalid username or password");
      }
    } catch (err) {
      const message = err.response?.data?.detail || err.response?.data?.message;
      alert(message || "Unable to complete authentication. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !loading) submit();
  };

  return (
    <main style={{
      minHeight: "100vh", display: "flex", justifyContent: "center",
      alignItems: "center", background: "linear-gradient(135deg, #07111f, #172554)",
      padding: 20, boxSizing: "border-box"
    }}>
      <section style={{
        background: "#111827", border: "1px solid #263449", padding: 36,
        borderRadius: 20, width: 380, maxWidth: "100%", textAlign: "center",
        boxShadow: "0 24px 70px rgba(0,0,0,.35)"
      }}>
        <div style={{ fontSize: 34 }}>◈</div>
        <h1 style={{ color: "white", margin: "8px 0" }}>TradeSight AI</h1>
        <p style={{ color: "#9ca3af", marginBottom: 26 }}>
          {registerMode ? "Create your research workspace" : "Market research · ML insights · Paper trading"}
        </p>

        <input
          type="text" placeholder="Username" autoComplete="username"
          value={user} onChange={(event) => setUser(event.target.value)}
          onKeyDown={handleKeyDown} disabled={loading}
          style={{
            boxSizing: "border-box", width: "100%", padding: 13, marginBottom: 14,
            borderRadius: 9, border: "1px solid #374151", outline: "none",
            background: "#1f2937", color: "white", fontSize: 15
          }}
        />
        <input
          type="password" placeholder={registerMode ? "Password (8+ characters)" : "Password"}
          autoComplete={registerMode ? "new-password" : "current-password"}
          minLength={registerMode ? 8 : undefined}
          value={pass} onChange={(event) => setPass(event.target.value)}
          onKeyDown={handleKeyDown} disabled={loading}
          style={{
            boxSizing: "border-box", width: "100%", padding: 13, marginBottom: 18,
            borderRadius: 9, border: "1px solid #374151", outline: "none",
            background: "#1f2937", color: "white", fontSize: 15
          }}
        />

        <button onClick={submit} disabled={loading} style={{
          width: "100%", padding: 13, borderRadius: 9, border: "none",
          background: loading ? "#166534" : "#16a34a", color: "white",
          fontSize: 16, cursor: loading ? "not-allowed" : "pointer", fontWeight: 700
        }}>
          {loading ? "Please wait…" : registerMode ? "Create account" : "Sign in"}
        </button>

        <button onClick={() => { setRegisterMode(!registerMode); setPass(""); }}
          disabled={loading} style={{
            marginTop: 17, background: "transparent", border: "none",
            color: "#93c5fd", cursor: "pointer", fontSize: 14
          }}>
          {registerMode ? "Already registered? Sign in" : "Create an account"}
        </button>

        <p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5, margin: "24px 0 0" }}>
          Research and educational paper-trading workspace only. Market data may be delayed.
          Model outputs are experimental and are not investment advice.
        </p>
      </section>
    </main>
  );
}

export default Login;
