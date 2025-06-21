export default function handler(req, res) {
  const token = Math.random().toString(36).substr(2) + Date.now();
  res.setHeader('Set-Cookie', `csrfToken=${token}; Path=/; HttpOnly; SameSite=Lax`);
  res.status(200).json({ csrfToken: token });
}
