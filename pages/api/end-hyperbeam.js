import fetch from 'node-fetch';
import cookie from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // CSRF check
  const cookies = cookie.parse(req.headers.cookie || '');
  const csrfCookie = cookies.csrfToken;
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  // API secret check (optional)
  if (process.env.API_SECRET && req.headers['x-api-secret'] !== process.env.API_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Get session info from cookie
  const sessionInfo = cookies.hyperbeam ? JSON.parse(cookies.hyperbeam) : null;
  if (!sessionInfo || !sessionInfo.session_id || !sessionInfo.admin_token) {
    return res.status(400).json({ error: 'No active session' });
  }

  try {
    await fetch(`https://engine.hyperbeam.com/v0/vm/${sessionInfo.session_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sessionInfo.admin_token}`,
        'Content-Type': 'application/json',
      },
    });

    // Clear session cookie
    res.setHeader(
      'Set-Cookie',
      cookie.serialize('hyperbeam', '', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        expires: new Date(0),
      })
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
