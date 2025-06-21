import React, { useEffect, useState, useRef } from "react";

// --- FULL IN-FILE API HANDLING FOR VERCEL ---
export async function getServerSideProps({ req, res }) {
  // --- Cookie Helpers ---
  function parseCookies(cookieHeader = "") {
    return Object.fromEntries(
      cookieHeader
        .split(";")
        .map(cookieStr => {
          const [key, ...v] = cookieStr.trim().split("=");
          return [key, decodeURIComponent(v.join("="))];
        })
        .filter(([k]) => k)
    );
  }
  function serializeCookie(name, value, options = {}) {
    let cookie = `${name}=${encodeURIComponent(value)}`;
    if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
    if (options.httpOnly) cookie += `; HttpOnly`;
    if (options.secure) cookie += `; Secure`;
    if (options.path) cookie += `; Path=${options.path}`;
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
    if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
    return cookie;
  }

  // --- Handle All API Endpoints In This File ---
  if (req.url.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");

    // CSRF Endpoint
    if (req.url === "/api/csrf" && req.method === "GET") {
      const token = Math.random().toString(36).slice(2) + Date.now();
      res.setHeader(
        "Set-Cookie",
        serializeCookie("csrfToken", token, {
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        })
      );
      res.end(JSON.stringify({ csrfToken: token }));
      return { props: {} };
    }

    // Create Hyperbeam Session
    if (req.url === "/api/hyperbeam" && req.method === "POST") {
      let body = "";
      await new Promise(resolve => {
        req.on("data", chunk => {
          body += chunk;
        });
        req.on("end", resolve);
      });
      const cookies = parseCookies(req.headers.cookie || "");
      const csrfCookie = cookies.csrfToken;
      const csrfHeader = req.headers["x-csrf-token"];
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "Invalid CSRF token" }));
        return { props: {} };
      }
      try {
        const resp = await fetch("https://engine.hyperbeam.com/v0/vm", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.HYPERBEAM_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expires_in: 720 }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.session_id || !data.admin_token || !data.embed_url) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: data.error || "Hyperbeam creation failed" }));
          return { props: {} };
        }
        res.setHeader(
          "Set-Cookie",
          serializeCookie(
            "hyperbeam",
            Buffer.from(
              JSON.stringify({
                session_id: data.session_id,
                admin_token: data.admin_token,
              })
            ).toString("base64"),
            {
              path: "/",
              httpOnly: true,
              sameSite: "Lax",
              maxAge: 60 * 15,
            }
          )
        );
        res.end(JSON.stringify({ url: data.embed_url, expires_in: 720 }));
        return { props: {} };
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
        return { props: {} };
      }
    }

    // End Hyperbeam Session
    if (req.url === "/api/end-hyperbeam" && req.method === "POST") {
      const cookies = parseCookies(req.headers.cookie || "");
      const csrfCookie = cookies.csrfToken;
      const csrfHeader = req.headers["x-csrf-token"];
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "Invalid CSRF token" }));
        return { props: {} };
      }
      const sessionInfo = cookies.hyperbeam
        ? JSON.parse(Buffer.from(cookies.hyperbeam, "base64").toString())
        : null;
      if (!sessionInfo?.session_id || !sessionInfo?.admin_token) {
        res.setHeader(
          "Set-Cookie",
          serializeCookie("hyperbeam", "", {
            httpOnly: true,
            sameSite: "Lax",
            path: "/",
            expires: new Date(0),
          })
        );
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "No active session" }));
        return { props: {} };
      }
      try {
        const hbRes = await fetch(
          `https://engine.hyperbeam.com/v0/vm/${sessionInfo.session_id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${sessionInfo.admin_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        res.setHeader(
          "Set-Cookie",
          serializeCookie("hyperbeam", "", {
            httpOnly: true,
            sameSite: "Lax",
            path: "/",
            expires: new Date(0),
          })
        );
        if (!hbRes.ok) {
          const errText = await hbRes.text();
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: `Failed to terminate Hyperbeam session: ${errText}`,
            })
          );
          return { props: {} };
        }
        res.end(JSON.stringify({ success: true }));
        return { props: {} };
      } catch (err) {
        res.setHeader(
          "Set-Cookie",
          serializeCookie("hyperbeam", "", {
            httpOnly: true,
            sameSite: "Lax",
            path: "/",
            expires: new Date(0),
          })
        );
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
        return { props: {} };
      }
    }

    // Not found
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
    return { props: {} };
  }

  // SSR: just render the UI
  return { props: {} };
}

// --- Main UI ---
export default function Home() {
  const [csrfToken, setCsrfToken] = useState(null);
  const [sessionUrl, setSessionUrl] = useState(null);
  const [timer, setTimer] = useState(0);
  const [timerId, setTimerId] = useState(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  // Fetch CSRF token on mount
  useEffect(() => {
    fetch("/api/csrf")
      .then(res => res.json())
      .then(data => setCsrfToken(data.csrfToken));
  }, []);

  // Timer decrement logic
  useEffect(() => {
    if (timer > 0 && running) {
      const id = setTimeout(() => setTimer(timer - 1), 1000);
      setTimerId(id);
      return () => clearTimeout(id);
    }
    if (timer === 0 && running) {
      stopSession();
    }
    // eslint-disable-next-line
  }, [timer, running]);

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function startSession() {
    setError("");
    setRunning(true); // Always set running so End button is visible
    fetch("/api/hyperbeam", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
    })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          setSessionUrl(data.url);
          setTimer(data.expires_in || 720);
        } else {
          setError(data.error || "Failed to start session");
          setRunning(false);
        }
      })
      .catch(err => {
        setError(err.message);
        setRunning(false);
      });
  }

  function stopSession() {
    setSessionUrl(null);
    setTimer(0);
    setRunning(false);
    if (timerId) clearTimeout(timerId);
    fetch("/api/end-hyperbeam", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
    });
  }

  // End session on tab close/hot reload
  useEffect(() => {
    const handler = () => stopSession();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
    // eslint-disable-next-line
  }, [csrfToken]);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#101925", color: "#fff", minHeight: "100vh", textAlign: "center", padding: "2rem" }}>
      <h1>Vapor-Style Hyperbeam Session</h1>
      <div id="controls">
        <button style={{
            background: "#4c75f2",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "1em 2em",
            fontSize: "1.1em",
            cursor: "pointer",
            margin: "1em"
          }}
          disabled={running}
          onClick={startSession}
          id="startBtn"
        >
          Start Session
        </button>
        <button style={{
            background: "#4c75f2",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "1em 2em",
            fontSize: "1.1em",
            cursor: "pointer",
            margin: "1em",
            display: running ? "" : "none"
          }}
          onClick={stopSession}
          id="endBtn"
        >
          End Session
        </button>
      </div>
      <div id="timer" style={{ fontSize: "1.2em", margin: "1em 0" }}>
        {running && timer > 0 ? `Time left: ${formatTime(timer)}` : ""}
      </div>
      <div id="sessionLink" style={{ marginBottom: "1em" }}>
        {sessionUrl && (
          <a href={sessionUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#4c75f2" }}>
            Open your VM
          </a>
        )}
      </div>
      <div id="error" style={{ color: "#ff6363", margin: "1em 0" }}>{error}</div>
    </div>
  );
}
