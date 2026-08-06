import jwt from 'jsonwebtoken';

const JWT_SECRET =
  process.env.JWT_SECRET || 'rua_sadiq_jwt_secret_change_me_in_production_2024';

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/** Extract and verify Bearer token from a Request. Returns decoded payload or null. */
export function getAdminFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    return verifyToken(authHeader.slice(7));
  } catch {
    return null;
  }
}

/** Returns a 401 Response if not authenticated; otherwise returns null. */
export function requireAdmin(request) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return Response.json({ message: 'No token provided or invalid token' }, { status: 401 });
  }
  return null;
}
