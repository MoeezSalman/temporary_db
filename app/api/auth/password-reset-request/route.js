import { connectDB } from '@/lib/db';
import User from '@/models/User';
import PasswordResetRequest from '@/models/PasswordResetRequest';

/**
 * POST /api/auth/password-reset-request
 * Public endpoint. Body: { email }
 * Creates a pending request so admin can reset the user's password.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const email = (body?.email || '').trim().toLowerCase();
  if (!email) {
    return Response.json({ message: 'Email is required' }, { status: 400 });
  }

  try {
    await connectDB();

    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).select('_id name email isActive');

    // Always return success message (don't leak whether email exists)
    if (!user) {
      return Response.json({
        message:
          'If an account with that email exists, the admin has been notified to reset your password.',
      });
    }

    if (!user.isActive) {
      return Response.json({
        message:
          'If an account with that email exists, the admin has been notified to reset your password.',
      });
    }

    // Avoid flooding: if a pending request already exists for this email, reuse it
    const existing = await PasswordResetRequest.findOne({
      email: user.email,
      status: 'pending',
    });

    if (!existing) {
      await PasswordResetRequest.create({
        email: user.email,
        userId: user._id,
        userName: user.name,
        status: 'pending',
      });
    }

    return Response.json({
      message:
        'If an account with that email exists, the admin has been notified to reset your password.',
    });
  } catch (err) {
    console.error('POST /api/auth/password-reset-request', err);
    return Response.json(
      { message: 'Failed to submit password reset request', error: err.message },
      { status: 500 }
    );
  }
}
