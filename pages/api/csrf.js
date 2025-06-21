import { nanoid } from 'nanoid';
import cookie from 'cookie';

export default function handler(req, res) {
  // Generate CSRF token and set as HTTP-only cookie
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
  res.status(200).json({ csrfToken });
}
