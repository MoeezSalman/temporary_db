import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Site from '@/models/Site';
import { getAdminFromRequest } from '@/lib/auth';

/** GET /api/auth/me */
export async function GET(request) {
  const decoded = getAdminFromRequest(request);
  if (!decoded) {
    return Response.json({ message: 'No token provided or invalid token' }, { status: 401 });
  }

  try {
    if (decoded.type === 'user' || decoded.email) {
      await connectDB();
      const user = await User.findById(decoded.id).select('-passwordHash').lean();
      if (!user) {
        return Response.json({ message: 'User not found' }, { status: 404 });
      }
      if (!user.isActive) {
        return Response.json(
          { message: 'Account is inactive. Contact an administrator.' },
          { status: 403 }
        );
      }
      let site = null;
      if (user.siteId) {
        site = await Site.findById(user.siteId).lean();
      }
      return Response.json({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        moduleAccess: user.moduleAccess,
        isActive: user.isActive,
        siteId: user.siteId || null,
        site: site
          ? {
              _id: site._id,
              name: site.name,
              slug: site.slug,
              customDomain: site.customDomain,
              industryType: site.industryType,
              isActive: site.isActive,
            }
          : null,
      });
    }

    return Response.json({
      id: decoded.id,
      name: decoded.username || decoded.name,
      email: decoded.username || decoded.email,
      role: 'admin',
      moduleAccess: { material: true, product: true, categories: true },
      siteId: null,
      site: null,
    });
  } catch (err) {
    return Response.json({ message: 'Error', error: err.message }, { status: 500 });
  }
}
