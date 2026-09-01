import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { requireAdmin } from '@/lib/auth';

/** GET /api/users – list all users (admin only) */
export async function GET(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const users = await User.find({})
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();
    return Response.json(users);
  } catch (err) {
    return Response.json(
      { message: 'Error fetching users', error: err.message },
      { status: 500 }
    );
  }
}

/** POST /api/users – create a new user (admin only) */
export async function POST(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, email, password, role = 'user', moduleAccess } = body || {};

  if (!name || !email || !password) {
    return Response.json(
      { message: 'name, email and password are required' },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return Response.json(
      { message: 'Password must be at least 6 characters' },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return Response.json({ message: 'A user with this email already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role === 'admin' ? 'admin' : 'user',
      moduleAccess: moduleAccess || { material: true, product: true, categories: true },
      isActive: true,
    });

    const obj = user.toObject();
    delete obj.passwordHash;

    return Response.json(obj, { status: 201 });
  } catch (err) {
    return Response.json(
      { message: 'Error creating user', error: err.message },
      { status: 500 }
    );
  }
}
