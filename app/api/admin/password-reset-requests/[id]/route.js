import { connectDB } from '@/lib/db';
import PasswordResetRequest from '@/models/PasswordResetRequest';
import User from '@/models/User';
import { requireAdmin, getAdminFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';

/**
 * PATCH /api/admin/password-reset-requests/:id
 * Body: { action: 'dismiss' | 'resolve', password?: string, note?: string }
 * - dismiss: mark as dismissed
 * - resolve: optionally set new password for the user, mark resolved
 */
export async function PATCH(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const action = (body?.action || '').toLowerCase();
  if (!['dismiss', 'resolve'].includes(action)) {
    return Response.json(
      { message: 'action must be "dismiss" or "resolve"' },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const { id } = await params;
    const item = await PasswordResetRequest.findById(id);
    if (!item) {
      return Response.json({ message: 'Request not found' }, { status: 404 });
    }

    const decoded = getAdminFromRequest(request);
    const adminLabel =
      decoded?.email || decoded?.username || decoded?.name || decoded?.id || 'admin';

    if (action === 'dismiss') {
      item.status = 'dismissed';
      item.resolvedBy = String(adminLabel);
      item.resolvedAt = new Date();
      if (body.note) item.note = String(body.note);
      await item.save();
      return Response.json(item.toObject());
    }

    // resolve
    if (body.password) {
      if (String(body.password).length < 6) {
        return Response.json(
          { message: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }
      const user =
        (item.userId && (await User.findById(item.userId))) ||
        (await User.findOne({ email: item.email }));
      if (!user) {
        return Response.json({ message: 'User not found for this request' }, { status: 404 });
      }
      user.passwordHash = await bcrypt.hash(String(body.password), 10);
      await user.save();
    }

    item.status = 'resolved';
    item.resolvedBy = String(adminLabel);
    item.resolvedAt = new Date();
    if (body.note) item.note = String(body.note);
    await item.save();

    return Response.json(item.toObject());
  } catch (err) {
    console.error('PATCH /api/admin/password-reset-requests/:id', err);
    return Response.json(
      { message: 'Failed to update request', error: err.message },
      { status: 500 }
    );
  }
}
