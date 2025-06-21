import fetch from 'node-fetch';

// --- Cookie Utilities ---
function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader.split(";").map(cookieStr => {
      const [key, ...v] = cookieStr.trim().split("=");
      return [key, decodeURIComponent(v.join("="))];
    }).filter(([k]) => k)
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

function generateCsrfToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export default async function handler(req, res) {
  const { type } = req.query;

  // --- 1. CSRF Token Issuance ---
  if (req.method === 'GET' && type === 'csrf') {
    const csrfToken = generateCsrfToken();
    res.setHeader(
      'Set-Cookie',
      serializeCookie('csrfToken', csrfToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60,
      })
    );
    return res.status(200).json({ csrfToken });
  }

  // --- 2. Hyperbeam Session Creation ---
  if (req.method === 'POST' && (!type || type === 'create')) {
    const cookies = parseCookies(req.headers.cookie || '');
    const csrfCookie = cookies.csrfToken;
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    if (process.env.API_SECRET && req.headers['x-api-secret'] !== process.env.API_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const API_KEY = process.env.HYPERBEAM_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'Missing Hyperbeam API key' });

    try {
      const { expires_in } = req.body || {};
      const payload = { expires_in: typeof expires_in === "number" ? expires_in : 300 };
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
        serializeCookie('hyperbeam', btoa(JSON.stringify({
          session_id: data.session_id,
          admin_token: data.admin_token,
        })), {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 15, // 15 minutes
        })
      );
      return res.status(200).json({ url: data.embed_url, expires_in: payload.expires_in });
    } catch (err) {
      return res.status(500).json({ error: 'Server error: ' + err.message });
    }
  }

  // --- 3. Hyperbeam Session Termination ---
  if (req.method === 'POST' && type === 'end') {
    const cookies = parseCookies(req.headers.cookie || '');
    const csrfCookie = cookies.csrfToken;
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    if (process.env.API_SECRET && req.headers['x-api-secret'] !== process.env.API_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const sessionInfo = cookies.hyperbeam ? JSON.parse(atob(cookies.hyperbeam)) : null;
    if (!sessionInfo || !sessionInfo.session_id || !sessionInfo.admin_token) {
      // Clear any old cookie just in case
      res.setHeader(
        'Set-Cookie',
        serializeCookie('hyperbeam', '', {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          expires: new Date(0),
        })
      );
      return res.status(400).json({ error: 'No active session' });
    }

    try {
      // Actually terminate the session on Hyperbeam
      const hbRes = await fetch(`https://engine.hyperbeam.com/v0/vm/${sessionInfo.session_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionInfo.admin_token}`,
          'Content-Type': 'application/json',
        },
      });
      const hbText = await hbRes.text();

      // Clean up the cookie regardless of success/failure
      res.setHeader(
        'Set-Cookie',
        serializeCookie('hyperbeam', '', {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          expires: new Date(0),
        })
      );

      if (!hbRes.ok) {
        return res.status(500).json({ error: `Failed to terminate Hyperbeam session: ${hbText}` });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      res.setHeader(
        'Set-Cookie',
        serializeCookie('hyperbeam', '', {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          expires: new Date(0),
        })
      );
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
