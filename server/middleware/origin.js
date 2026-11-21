import { env } from '../config/env.js';
export function allowedOrigin(origin, host, protocol = 'http') {
  if (!origin) return true; // CLI clients still require valid session credentials.
  return origin === `${protocol}://${host}` || env.origins.includes(origin);
}
export function originGuard(req, res, next) {
  const origin = req.get('origin');
  if (!allowedOrigin(origin, req.get('host'), req.protocol))
    return res.status(403).json({ message: 'This origin is not allowed.' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.vary('Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.sendStatus(204);
  }
  if (
    ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) &&
    req.get('sec-fetch-site') === 'cross-site' &&
    !env.origins.includes(origin)
  )
    return res.status(403).json({ message: 'Cross-site request rejected.' });
  next();
}
