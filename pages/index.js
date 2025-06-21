import React, { useState } from "react";

export default function Home() {
  const [csrf, setCsrf] = useState("");
  const [hbUrl, setHbUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [ending, setEnding] = useState(false);
  const [expiresIn, setExpiresIn] = useState(0);
  const [timer, setTimer] = useState(null);

  const API_SECRET = "8GdkvF3nL0wQz6Tr5bY2pRx9sJ1VhMnC"; // your secret

  // Helper to clear the countdown timer
  const clearSessionTimer = () => {
    if (timer) clearTimeout(timer);
    setTimer(null);
    setExpiresIn(0);
  };

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

  // 2. Start Hyperbeam session (5 minutes)
  const startSession = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/hyperbeam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          "x-api-secret": API_SECRET,
        },
        body: JSON.stringify({
          expires_in: 300, // 5 minutes in seconds
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setHbUrl(data.url);
        setSessionActive(true);
        setExpiresIn(300);

        // Start countdown and auto-end session after 5 minutes
        const t = setTimeout(() => {
          handleAutoEndSession();
        }, 300 * 1000);
        setTimer(t);
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
          "x-api-secret": API_SECRET,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSessionActive(false);
        setHbUrl("");
        clearSessionTimer();
      } else {
        setError(data.error || "Failed to end session");
      }
    } catch (err) {
      setError("Network error: " + err.message);
    }
    setEnding(false);
  };

  // 4. Auto end session after 5 minutes
  const handleAutoEndSession = async () => {
    setError("");
    setEnding(true);
    try {
      const res = await fetch("/api/hyperbeam?type=end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
          "x-api-secret": API_SECRET,
        },
      });
      setSessionActive(false);
      setHbUrl("");
      clearSessionTimer();
    } catch (err) {
      setError("Session auto-end failed: " + err.message);
    }
    setEnding(false);
  };

  // Countdown UI
  React.useEffect(() => {
    if (!sessionActive || expiresIn <= 0) return;
    const interval = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionActive, expiresIn]);

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <h1>Hyperbeam Demo (5 Minute Session Limit)</h1>
      <div style={{ marginBottom: 20 }}>
        {!csrf && (
          <button onClick={getCsrf} disabled={loading}>
            {loading ? "Loading..." : "Get CSRF Token"}
          </button>
        )}
        {csrf && !sessionActive && (
          <button onClick={startSession} disabled={loading}>
            {loading ? "Starting..." : "Start Hyperbeam Session (5 min)"}
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
          <div style={{ marginTop: 10, fontWeight: "bold", color: "#0070f3" }}>
            Time left: {Math.floor(expiresIn / 60)
              .toString()
              .padStart(2, "0")}
            :{(expiresIn % 60).toString().padStart(2, "0")}
          </div>
        </div>
      )}
      <div style={{ marginTop: 40, color: "#555", fontSize: 13 }}>
        <p>
          <b>Instructions:</b>
        </p>
        <ol>
          <li>Click <b>Get CSRF Token</b> (required for secure APIs).</li>
          <li>Click <b>Start Hyperbeam Session</b>. The embed will appear if successful and will auto-end after 5 minutes.</li>
          <li>Click <b>End Hyperbeam Session</b> to close it manually.</li>
        </ol>
        <p>
          <b>Warning:</b> This demo uses a hardcoded API secret for demonstration. In production, use a secure method.<br />
          Add your own authentication for real users.
        </p>
      </div>
    </main>
  );
}
