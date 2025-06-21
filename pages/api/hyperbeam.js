import fetch from 'node-fetch';
import cookie from 'cookie';

export default async function handler(req, res) {
  // Protect: POST only
  if (req.method !== 'POST') return res.status(405).end();

  // CSRF check
  const cookies = cookie.parse(req.headers.cookie || '');
  const csrfCookie = cookies.csrfToken;
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  // API secret check (optional, adds another layer)
  if (process.env.API_SECRET && req.headers['x-api-secret'] !== process.env.API_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Hyperbeam session creation
  const API_KEY = process.env.HYPERBEAM_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing Hyperbeam API key' });

  try {
    const payload = { expires_in: 720 }; // 12 minutes
    const response = await fetch('https://engine.hyperbeam.com/v0/vm', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.session_id || !data.admin_token || !data.embed_url) {
      return res.status(500).json({ error: data.error || 'Hyperbeam session creation failed' });
    }

    // Store session info in cookie for later termination (secure, httpOnly, not accessible by JS)
    res.setHeader(
      'Set-Cookie',
      cookie.serialize('hyperbeam', JSON.stringify({
        session_id: data.session_id,
        admin_token: data.admin_token,
      }), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 15, // 15 minutes
      })
    );

    return res.status(200).json({ url: data.embed_url, expires_in: 720 });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
