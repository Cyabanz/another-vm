const HB_API_KEY = process.env.HYPERBEAM_API_KEY; // Should be set in your Vercel/Next.js env
const API_SECRET = process.env.API_SECRET || "8GdkvF3nL0wQz6Tr5bY2pRx9sJ1VhMnC"; // Replace with your secret

// Simple in-memory storage (not for production)
let sessionInfo = {};

// Helper to randomize CSRF
function makeCsrf() {
  return Math.random().toString(36).slice(2) + Date.now();
}

export default async function handler(req, res) {
  const { type } = req.query;

  // 1. CSRF token endpoint
  if (req.method === "GET" && type === "csrf") {
    const csrfToken = makeCsrf();
    sessionInfo.csrfToken = csrfToken;
    res.status(200).json({ csrfToken });
    return;
  }

  const csrfHeader = req.headers["x-csrf-token"];
  const apiSecret = req.headers["x-api-secret"];

  // 2. Validate CSRF and secret for POSTs
  if (
    !csrfHeader ||
    !sessionInfo.csrfToken ||
    csrfHeader !== sessionInfo.csrfToken
  ) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }
  if (!apiSecret || apiSecret !== API_SECRET) {
    res.status(403).json({ error: "Invalid API secret" });
    return;
  }

  // 3. Start session
  if (req.method === "POST" && !type) {
    try {
      const hbRes = await fetch("https://engine.hyperbeam.com/v0/vm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HB_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expires_in: 600 }),
      });
      const data = await hbRes.json();
      if (!hbRes.ok || !data.session_id || !data.embed_url || !data.admin_token) {
        res.status(500).json({ error: data.error || "Hyperbeam error" });
        return;
      }
      // Store info for end
      sessionInfo.session_id = data.session_id;
      sessionInfo.admin_token = data.admin_token;
      res.status(200).json({ url: data.embed_url });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // 4. End session
  if (req.method === "POST" && type === "end") {
    if (!sessionInfo.session_id || !sessionInfo.admin_token) {
      res.status(400).json({ error: "No active session" });
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
      // Clean up
      sessionInfo = {};
      if (!delRes.ok) {
        res.status(500).json({ error: "Failed to end session" });
        return;
      }
      res.status(200).json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  // 5. Not found
  res.status(404).json({ error: "Not found" });
}
