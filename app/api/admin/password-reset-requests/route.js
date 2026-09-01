import { connectDB } from '@/lib/db';
import PasswordResetRequest from '@/models/PasswordResetRequest';
import { requireAdmin } from '@/lib/auth';

/**
 * GET /api/admin/password-reset-requests
 * Admin only. Optional query: ?status=pending|resolved|dismissed|all
 */
export async function GET(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') || 'pending').toLowerCase();

    const filter = status === 'all' ? {} : { status };
    const items = await PasswordResetRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return Response.json(items);
  } catch (err) {
    console.error('GET /api/admin/password-reset-requests', err);
    return Response.json(
      { message: 'Failed to fetch requests', error: err.message },
      { status: 500 }
    );
  }
}
