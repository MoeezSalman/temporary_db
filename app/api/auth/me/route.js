import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { getAdminFromRequest } from '@/lib/auth';

/** GET /api/auth/me */
export async function GET(request) {
  const decoded = getAdminFromRequest(request);
  if (!decoded) {
    return Response.json({ message: 'No token provided or invalid token' }, { status: 401 });
  }

  try {
    // If it came from the new User model
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
      return Response.json({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        moduleAccess: user.moduleAccess,
        isActive: user.isActive,
      });
    }

    // Legacy admin token
    return Response.json({
      id: decoded.id,
      name: decoded.username || decoded.name,
      email: decoded.username || decoded.email,
      role: 'admin',
      moduleAccess: { material: true, product: true, categories: true },
    });
  } catch (err) {
    return Response.json({ message: 'Error', error: err.message }, { status: 500 });
  }
}
