import React, { useState } from "react";

export default function Home() {
  const [csrf, setCsrf] = useState("");
  const [hbUrl, setHbUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [ending, setEnding] = useState(false);

  // 1. Fetch CSRF token
  const getCsrf = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/hyperbeam?type=csrf");
      const data = await res.json();
      if (res.ok && data.csrfToken) {
        setCsrf(data.csrfToken);
      } else {
        setError("Failed to get CSRF token");
      }
    } catch (err) {
      setError("Network error: " + err.message);
    }
    setLoading(false);
  };

  // 2. Start Hyperbeam session
  const startSession = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/hyperbeam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          "x-api-secret": "8GdkvF3nL0wQz6Tr5bY2pRx9sJ1VhMnC", // your secret
        },
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setHbUrl(data.url);
        setSessionActive(true);
      } else {
        setError(data.error || "Failed to start session");
      }
    } catch (err) {
      setError("Network error: " + err.message);
    }
    setLoading(false);
  };

  // 3. End Hyperbeam session
  const endSession = async () => {
    setError("");
    setEnding(true);
    try {
      const res = await fetch("/api/hyperbeam?type=end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          "x-api-secret": "8GdkvF3nL0wQz6Tr5bY2pRx9sJ1VhMnC", // your secret
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSessionActive(false);
        setHbUrl("");
      } else {
        setError(data.error || "Failed to end session");
      }
    } catch (err) {
      setError("Network error: " + err.message);
    }
    setEnding(false);
  };

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <h1>Hyperbeam Demo</h1>
      <div style={{ marginBottom: 20 }}>
        {!csrf && (
          <button onClick={getCsrf} disabled={loading}>
            {loading ? "Loading..." : "Get CSRF Token"}
          </button>
        )}
        {csrf && !sessionActive && (
          <button onClick={startSession} disabled={loading}>
            {loading ? "Starting..." : "Start Hyperbeam Session"}
          </button>
        )}
        {sessionActive && (
          <button onClick={endSession} disabled={ending}>
            {ending ? "Ending..." : "End Hyperbeam Session"}
          </button>
        )}
      </div>
      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          <b>Error:</b> {error}
        </div>
      )}
      {hbUrl && sessionActive && (
        <div style={{ marginTop: 20 }}>
          <h2>Session Embed</h2>
          <iframe
            src={hbUrl}
            title="Hyperbeam"
            width="100%"
            height="400"
            allow="autoplay; clipboard-write; camera; microphone"
            frameBorder="0"
            allowFullScreen
          />
        </div>
      )}
      <div style={{ marginTop: 40, color: "#555", fontSize: 13 }}>
        <p>
          <b>Instructions:</b>
        </p>
        <ol>
          <li>Click <b>Get CSRF Token</b> (required for secure APIs).</li>
          <li>Click <b>Start Hyperbeam Session</b>. The embed will appear if successful.</li>
          <li>Click <b>End Hyperbeam Session</b> to close it.</li>
        </ol>
        <p>
          If you set <code>API_SECRET</code> in your backend, make sure it matches in your frontend code.<br />
          This demo is for educational purposes—add your own authentication for production use.
        </p>
      </div>
    </main>
  );
}
