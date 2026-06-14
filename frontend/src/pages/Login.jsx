import React, { useState } from "react";
import API from "../services/api";

function Login({ setLoggedIn }) {

  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  const login = async () => {

    try {

      const res = await API.post("/login", {
        username: user,
        password: pass
      });

      if (res.data.status === "success") {

        localStorage.setItem(
          "token",
          res.data.token
        );

        setLoggedIn(true);

      } else {

        alert("Wrong credentials");

      }

    } catch (err) {

      console.log(err);

      alert("Server error");

    }

  };

  return (

    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background:
          "linear-gradient(to right, #0f172a, #1e293b)"
      }}
    >

      <div
        style={{
          background: "#111827",
          padding: "40px",
          borderRadius: "20px",
          width: "350px",
          textAlign: "center",
          boxShadow:
            "0px 0px 30px rgba(0,0,0,0.5)"
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

        <input
          placeholder="Username"
          onChange={(e) => setUser(e.target.value)}
          style={{
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

        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPass(e.target.value)}
          style={{
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

        <button
          onClick={login}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "none",
            background: "#22c55e",
            color: "white",
            fontSize: "18px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Login
        </button>

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