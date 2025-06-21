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
  if (req.method !== 'POST') return res.status(405).end();

  const cookies = parseCookies(req.headers.cookie || '');
  const csrfCookie = cookies.csrfToken;
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  const sessionInfo = cookies.hyperbeam ? JSON.parse(atob(cookies.hyperbeam)) : null;
  if (!sessionInfo?.session_id || !sessionInfo?.admin_token) {
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
    const hbRes = await fetch(`https://engine.hyperbeam.com/v0/vm/${sessionInfo.session_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sessionInfo.admin_token}`,
        'Content-Type': 'application/json',
      },
    });
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
      const errText = await hbRes.text();
      return res.status(500).json({ error: `Failed to terminate Hyperbeam session: ${errText}` });
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
