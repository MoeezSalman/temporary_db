import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { requireAdmin } from '@/lib/auth';

/** PATCH /api/users/:id/password – admin resets a user's password */
export async function PATCH(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const { password } = body || {};
  if (!password || password.length < 6) {
    return Response.json(
      { message: 'Password must be at least 6 characters' },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const { id } = await params;

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(
      id,
      { passwordHash },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return Response.json({ message: 'User not found' }, { status: 404 });
    }

    return Response.json({ message: 'Password reset successfully' });
  } catch (err) {
    return Response.json(
      { message: 'Error resetting password', error: err.message },
      { status: 500 }
    );
  }
}
