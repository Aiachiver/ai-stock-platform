import React, { useState } from "react";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  return (
    <>
      {loggedIn ? (
        <Dashboard />
      ) : (
        <Login setLoggedIn={setLoggedIn} />
      )}
    </>
  );
}

export default App;