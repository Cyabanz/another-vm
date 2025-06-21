try {
  const hbRes = await fetch("https://engine.hyperbeam.com/v0/vm", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HB_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expires_in: 600 }),
  });

  let data;
  try {
    data = await hbRes.json();
  } catch (error) {
    console.error("Failed to parse JSON response:", error.message);
    data = {}; // Fallback to empty object
  }

  if (!hbRes.ok || !data.session_id || !data.embed_url || !data.admin_token) {
    console.error("Hyperbeam API Error:", data.error || hbRes.statusText);
    res.status(500).json({ error: data.error || "Hyperbeam error" });
    return;
  }

  sessionInfo.session_id = data.session_id;
  sessionInfo.admin_token = data.admin_token;
  res.status(200).json({ url: data.embed_url });
} catch (error) {
  console.error("Request Failed:", error.message);
  res.status(500).json({ error: error.message });
}