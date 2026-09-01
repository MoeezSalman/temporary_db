import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { requireAdmin } from '@/lib/auth';

/** GET /api/users/:id */
export async function GET(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { id } = await params;
    const user = await User.findById(id).select('-passwordHash').lean();
    if (!user) {
      return Response.json({ message: 'User not found' }, { status: 404 });
    }
    return Response.json(user);
  } catch (err) {
    return Response.json({ message: 'Error fetching user', error: err.message }, { status: 500 });
  }
}

/** PUT /api/users/:id – update name, role, isActive, moduleAccess */
export async function PUT(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    await connectDB();
    const { id } = await params;

    const updates = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.role !== undefined) updates.role = body.role === 'admin' ? 'admin' : 'user';
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);
    if (body.moduleAccess !== undefined) updates.moduleAccess = body.moduleAccess;

    const user = await User.findByIdAndUpdate(id, updates, { new: true })
      .select('-passwordHash')
      .lean();

    if (!user) {
      return Response.json({ message: 'User not found' }, { status: 404 });
    }
    return Response.json(user);
  } catch (err) {
    return Response.json({ message: 'Error updating user', error: err.message }, { status: 500 });
  }
}

/** DELETE /api/users/:id */
export async function DELETE(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { id } = await params;

    // Prevent deleting the last admin
    const user = await User.findById(id);
    if (!user) {
      return Response.json({ message: 'User not found' }, { status: 404 });
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return Response.json(
          { message: 'Cannot delete the last admin user' },
          { status: 400 }
        );
      }
    }

    await User.findByIdAndDelete(id);
    return Response.json({ message: 'User deleted successfully' });
  } catch (err) {
    return Response.json({ message: 'Error deleting user', error: err.message }, { status: 500 });
  }
}
