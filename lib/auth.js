import jwt from 'jsonwebtoken';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Site from '@/models/Site';

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

/**
 * Resolve the Site for the authenticated user.
 * - Admin (type/role admin) may pass ?siteId= or body.siteId to act on any site;
 *   otherwise returns null site (admin sees all when no siteId).
 * - Regular user: loads user.siteId and returns that Site.
 * Returns { decoded, site, siteId, errorResponse } 
 */
export async function resolveUserSite(request, { allowAdminAll = true } = {}) {
  const decoded = getAdminFromRequest(request);
  if (!decoded) {
    return {
      decoded: null,
      site: null,
      siteId: null,
      errorResponse: Response.json(
        { message: 'No token provided or invalid token' },
        { status: 401 }
      ),
    };
  }

  const isAdmin =
    decoded.role === 'admin' || decoded.type === 'admin';

  await connectDB();

  // Optional explicit siteId from query (admin only)
  const url = new URL(request.url);
  const querySiteId = url.searchParams.get('siteId');

  if (isAdmin && allowAdminAll) {
    if (querySiteId) {
      const site = await Site.findById(querySiteId).lean();
      if (!site) {
        return {
          decoded,
          site: null,
          siteId: null,
          errorResponse: Response.json({ message: 'Site not found' }, { status: 404 }),
        };
      }
      return { decoded, site, siteId: site._id, errorResponse: null };
    }
    // Admin with no siteId filter → all data
    return { decoded, site: null, siteId: null, errorResponse: null };
  }

  // Regular user (or admin acting as self)
  let userId = decoded.id;
  const user = await User.findById(userId).lean();
  if (!user) {
    return {
      decoded,
      site: null,
      siteId: null,
      errorResponse: Response.json({ message: 'User not found' }, { status: 404 }),
    };
  }

  if (!user.siteId) {
    return {
      decoded,
      site: null,
      siteId: null,
      errorResponse: Response.json(
        { message: 'No store assigned to this account. Contact admin.' },
        { status: 403 }
      ),
    };
  }

  const site = await Site.findById(user.siteId).lean();
  if (!site || !site.isActive) {
    return {
      decoded,
      site: null,
      siteId: null,
      errorResponse: Response.json(
        { message: 'Store is inactive or missing' },
        { status: 403 }
      ),
    };
  }

  return { decoded, site, siteId: site._id, errorResponse: null };
}
