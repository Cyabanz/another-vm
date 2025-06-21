import fetch from 'node-fetch';
import { nanoid } from 'nanoid';
import cookie from 'cookie';

export default async function handler(req, res) {
  // Route selection
  // Support three endpoints via ?type=csrf, ?type=end, or POST (default: create session)
  const { type } = req.query;

  // --- 1. CSRF Token Issuance ---
  if (req.method === 'GET' && type === 'csrf') {
    const csrfToken = nanoid(32);
    res.setHeader(
      'Set-Cookie',
      cookie.serialize('csrfToken', csrfToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60, // 1 hour
      })
    );
    return res.status(200).json({ csrfToken });
  }

  // --- 2. Hyperbeam Session Creation ---
  if (req.method === 'POST' && (!type || type === 'create')) {
    // CSRF validation
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
    // Hyperbeam API key
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

      // Store session info in httpOnly cookie for later termination
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

  // --- 3. Hyperbeam Session Termination ---
  if (req.method === 'POST' && type === 'end') {
    // CSRF validation
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

  // --- 4. Unknown method or type ---
  return res.status(405).json({ error: 'Method Not Allowed' });
}
