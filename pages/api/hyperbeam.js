const HB_API_KEY = process.env.HYPERBEAM_API_KEY; // Ensure this is set in your environment variables
const API_SECRET = process.env.API_SECRET; // Replace with your own secret

// Simple in-memory storage (not suitable for production)
let sessionInfo = {};

// Helper function to generate a CSRF token
function makeCsrf() {
  return Math.random().toString(36).slice(2) + Date.now();
}

export default async function handler(req, res) {
  const { type } = req.query;

  // 1. Handle CSRF token generation
  if (req.method === "GET" && type === "csrf") {
    const csrfToken = makeCsrf();
    sessionInfo.csrfToken = csrfToken;
    res.status(200).json({ csrfToken });
    return;
  }

  // Validate CSRF and API secret for POST requests
  const csrfHeader = req.headers["x-csrf-token"];
  const apiSecret = req.headers["x-api-secret"];

  if (
    req.method === "POST" &&
    (!csrfHeader || csrfHeader !== sessionInfo.csrfToken)
  ) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  if (req.method === "POST" && (!apiSecret || apiSecret !== API_SECRET)) {
    res.status(403).json({ error: "Invalid API secret" });
    return;
  }

  // 2. Start a Hyperbeam session
  if (req.method === "POST" && !type) {
    try {
      const hbRes = await fetch("https://engine.hyperbeam.com/v0/vm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HB_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expires_in: 600 }), // Set session expiration to 10 minutes
      });

      const data = await hbRes.json();
      if (!hbRes.ok || !data.session_id || !data.embed_url || !data.admin_token) {
        res.status(500).json({ error: data.error || "Error with Hyperbeam API" });
        return;
      }

      // Store session data
      sessionInfo.session_id = data.session_id;
      sessionInfo.admin_token = data.admin_token;

      // Return the embed URL
      res.status(200).json({ embedUrl: data.embed_url });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to start session" });
    }
    return;
  }

  // 3. End a Hyperbeam session
  if (req.method === "POST" && type === "end") {
    if (!sessionInfo.session_id || !sessionInfo.admin_token) {
      res.status(400).json({ error: "No active session to end" });
      return;
    }

    try {
      const delRes = await fetch(
        `https://engine.hyperbeam.com/v0/vm/${sessionInfo.session_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${sessionInfo.admin_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Clear session data
      sessionInfo = {};

      if (!delRes.ok) {
        res.status(500).json({ error: "Failed to end session" });
        return;
      }

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message || "Error ending session" });
    }
    return;
  }

  // 4. Handle unknown routes
  res.status(404).json({ error: "Endpoint not found" });
}