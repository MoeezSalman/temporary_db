import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Admin from '@/models/Admin';
import { signToken } from '@/lib/auth';

/**
 * POST /api/auth/login
 * Supports both the new User model and the existing Admin model.
 * Body: { email or username, password }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, username, password } = body || {};
  const identifier = (email || username || '').trim().toLowerCase();

  if (!identifier || !password) {
    return Response.json(
      { message: 'Email/username and password are required' },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    // 1) Try new User model first (case-insensitive email)
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });

    if (user) {
      if (!user.isActive) {
        return Response.json({ message: 'Account is inactive' }, { status: 403 });
      }
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return Response.json({ message: 'Invalid credentials' }, { status: 401 });
      }

      const token = signToken({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        type: 'user',
      });

      return Response.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          moduleAccess: user.moduleAccess,
        },
      });
    }

    // 2) Fallback to existing Admin model (username based, case-insensitive)
    const admin = await Admin.findOne({
      username: { $regex: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (admin) {
      const match = await bcrypt.compare(password, admin.passwordHash);
      if (!match) {
        return Response.json({ message: 'Invalid credentials' }, { status: 401 });
      }

      const token = signToken({
        id: admin._id.toString(),
        username: admin.username,
        role: 'admin',
        type: 'admin',
      });

      return Response.json({
        token,
        user: {
          id: admin._id,
          name: admin.username,
          email: admin.username,
          role: 'admin',
          moduleAccess: { material: true, product: true, categories: true },
        },
      });
    }

    return Response.json({ message: 'Invalid credentials' }, { status: 401 });
  } catch (err) {
    return Response.json(
      { message: 'Login failed', error: err.message },
      { status: 500 }
    );
  }
}
