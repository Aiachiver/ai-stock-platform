import React, { useState } from "react";
import API from "../services/api";

function Login({ setLoggedIn }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!user.trim() || !pass.trim()) {
      alert("Please enter username and password");
      return;
    }

    try {
      setLoading(true);

      const res = await API.post("/login", {
        username: user,
        password: pass
      });

      if (res.data.status === "success") {
        localStorage.setItem("token", res.data.token);
        setLoggedIn(true);
      } else {
        alert("Wrong username or password");
      }

    } catch (err) {
      console.log("LOGIN ERROR:", err);
      alert("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      login();
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(to right, #0f172a, #1e293b)",
        padding: "20px"
      }}
    >
      <div
        style={{
          background: "#111827",
          padding: "40px",
          borderRadius: "20px",
          width: "350px",
          maxWidth: "100%",
          textAlign: "center",
          boxShadow: "0px 0px 30px rgba(0,0,0,0.5)"
        }}
      >
        <h1
          style={{
            color: "white",
            marginBottom: "10px"
          }}
        >
          📈 AI Trading Platform
        </h1>

        <p
          style={{
            color: "#9ca3af",
            marginBottom: "30px"
          }}
        >
          Smart Stock Prediction Dashboard
        </p>

        {/* USERNAME */}
        <input
          type="text"
          placeholder="Username"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          style={{
            boxSizing: "border-box",
            width: "100%",
            padding: "12px",
            marginBottom: "15px",
            borderRadius: "10px",
            border: "none",
            outline: "none",
            background: "#1f2937",
            color: "white",
            fontSize: "16px"
          }}
        />

        {/* PASSWORD */}
        <input
          type="password"
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          style={{
            boxSizing: "border-box",
            width: "100%",
            padding: "12px",
            marginBottom: "20px",
            borderRadius: "10px",
            border: "none",
            outline: "none",
            background: "#1f2937",
            color: "white",
            fontSize: "16px"
          }}
        />

        {/* LOGIN BUTTON */}
        <button
          onClick={login}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "none",
            background: loading ? "#166534" : "#22c55e",
            color: "white",
            fontSize: "18px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "bold"
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {/* DEMO LOGIN */}
        <p
          style={{
            color: "#6b7280",
            marginTop: "20px",
            fontSize: "14px"
          }}
        >
          Demo Login → admin / 1234
        </p>
      </div>
    </div>
  );
}

export default Login;