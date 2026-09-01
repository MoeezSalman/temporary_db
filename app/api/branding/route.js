import { connectDB } from '@/lib/db';
import Branding from '@/models/Branding';
import { getAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/** GET /api/branding – public (used by storefront + portal) */
export async function GET() {
  try {
    await connectDB();
    let branding = await Branding.findOne().lean();
    if (!branding) {
      branding = await Branding.create({});
      branding = branding.toObject();
    }
    return Response.json(branding, { headers: { 'Cache-Control': 'no-store, must-revalidate' } });
  } catch (err) {
    return Response.json(
      { message: 'Error fetching branding', error: err.message },
      { status: 500 }
    );
  }
}

/** PUT /api/branding – any authenticated user/admin can update */
export async function PUT(request) {
  const decoded = getAdminFromRequest(request);
  if (!decoded) {
    return Response.json({ message: 'No token provided or invalid token' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    await connectDB();

    const updates = {};
    if (body.brandName !== undefined) updates.brandName = String(body.brandName).trim() || 'Rua Sadiq';
    if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl;
    if (body.logoImageId !== undefined) updates.logoImageId = body.logoImageId;
    if (body.primaryColor !== undefined) updates.primaryColor = body.primaryColor;
    if (body.secondaryColor !== undefined) updates.secondaryColor = body.secondaryColor;
    if (body.accentColor !== undefined) updates.accentColor = body.accentColor;

    const branding = await Branding.findOneAndUpdate({}, updates, {
      new: true,
      upsert: true,
    }).lean();

    return Response.json(branding);
  } catch (err) {
    return Response.json(
      { message: 'Error updating branding', error: err.message },
      { status: 500 }
    );
  }
}
