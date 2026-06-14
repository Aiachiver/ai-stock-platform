import React, { useState } from "react";

export default function LoginPage({ onLogin }) {
  const [name,setName]=useState("");

  return (
    <div>
      <input onChange={(e)=>setName(e.target.value)} />
      <button onClick={()=>onLogin(name)}>Login</button>
    </div>
  );
}