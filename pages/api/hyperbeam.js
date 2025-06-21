import fetch from 'node-fetch';

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader.split(";").map(c => {
      const [k, ...v] = c.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
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

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const cookies = parseCookies(req.headers.cookie || '');
    const csrfCookie = cookies.csrfToken;
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    try {
      const response = await fetch('https://engine.hyperbeam.com/v0/vm', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HYPERBEAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expires_in: 720 }),
      });
      const data = await response.json();

      if (!response.ok || !data.session_id || !data.admin_token || !data.embed_url) {
        return res.status(500).json({ error: data.error || 'Hyperbeam creation failed' });
      }

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
          maxAge: 60 * 15,
        })
      );
      return res.status(200).json({ url: data.embed_url, expires_in: 720 });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  res.status(405).end();
}
