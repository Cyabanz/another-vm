const API_SECRET = process.env.API_SECRET; // Use environment variable

app.post("/api/hyperbeam", async (req, res) => {
  const csrfToken = req.headers["x-csrf-token"];
  const apiSecret = req.headers["x-api-secret"];

  if (!csrfToken || csrfToken !== sessionCsrfToken) {
    return res.status(403).json({ error: "Invalid CSRF Token" });
  }

  if (!apiSecret || apiSecret !== API_SECRET) {
    return res.status(403).json({ error: "Invalid API Secret" });
  }

  try {
    const hbRes = await fetch("https://engine.hyperbeam.com/v0/vm", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HYPERBEAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expires_in: 600 }),
    });

    const data = await hbRes.json();
    if (!hbRes.ok || !data.session_id || !data.embed_url || !data.admin_token) {
      return res.status(500).json({ error: data.error || "Hyperbeam error" });
    }

    sessionInfo.session_id = data.session_id;
    sessionInfo.admin_token = data.admin_token;
    res.status(200).json({ url: data.embed_url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});