import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { requireAdmin } from '@/lib/auth';

/** PATCH /api/users/:id/modules – update only module access */
export async function PATCH(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const { material, product, categories } = body || {};

  try {
    await connectDB();
    const { id } = await params;

    const moduleAccess = {
      material: material !== undefined ? Boolean(material) : true,
      product: product !== undefined ? Boolean(product) : true,
      categories: categories !== undefined ? Boolean(categories) : true,
    };

    const user = await User.findByIdAndUpdate(
      id,
      { moduleAccess },
      { new: true }
    )
      .select('-passwordHash')
      .lean();

    if (!user) {
      return Response.json({ message: 'User not found' }, { status: 404 });
    }

    return Response.json(user);
  } catch (err) {
    return Response.json(
      { message: 'Error updating module access', error: err.message },
      { status: 500 }
    );
  }
}
