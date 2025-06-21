import React, { useState } from "react";

export default function Home() {
  const [csrf, setCsrf] = useState("");
  const [hbUrl, setHbUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionActive, setSessionActive] = useState(false);

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
          // "x-api-secret": "MY_SECRET", // Uncomment if using API_SECRET
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
    setLoading(true);
    try {
      const res = await fetch("/api/hyperbeam?type=end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          // "x-api-secret": "MY_SECRET", // Uncomment if using API_SECRET
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
    setLoading(false);
  };

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <h1>Hyperbeam Demo</h1>
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
        <button onClick={endSession} disabled={loading}>
          {loading ? "Ending..." : "End Hyperbeam Session"}
        </button>
      )}
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
          If you set <code>API_SECRET</code> in your backend, uncomment the <code>x-api-secret</code> lines and put your secret.<br />
          This demo is for educational purposes—add your own authentication for production use.
        </p>
      </div>
    </main>
  );
}
