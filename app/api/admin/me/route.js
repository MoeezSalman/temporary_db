import { getAdminFromRequest } from '@/lib/auth';

export async function GET(request) {
  const decoded = getAdminFromRequest(request);
  if (!decoded) {
    return Response.json({ message: 'No token' }, { status: 401 });
  }
  return Response.json({ username: decoded.username, id: decoded.id });
}
