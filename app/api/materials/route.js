import { connectDB } from '@/lib/db';
import Material from '@/models/Material';
import { requireAdmin, resolveUserSite } from '@/lib/auth';
import { saveFileToGridFS, assertImageFile } from '@/lib/gridfs';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const query = {};
    if (searchParams.get('group')) query.group = searchParams.get('group');

    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const { siteId, errorResponse, decoded } = await resolveUserSite(request);
      if (siteId) query.siteId = siteId;
      else if (decoded && !(decoded.role === 'admin' || decoded.type === 'admin')) {
        return errorResponse || Response.json({ message: 'No store assigned' }, { status: 403 });
      }
    } else {
      query.$or = [{ siteId: null }, { siteId: { $exists: false } }];
    }

    const materials = await Material.find(query)
      .sort({ group: 1, sortOrder: 1, createdAt: 1 })
      .lean();
    return Response.json(materials);
  } catch (err) {
    return Response.json(
      { message: 'Error fetching materials', error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { siteId, errorResponse } = await resolveUserSite(request);
    if (errorResponse) return errorResponse;
    if (!siteId) {
      return Response.json(
        { message: 'No store assigned. Admin must create a site for this user first.' },
        { status: 403 }
      );
    }

    const form = await request.formData();
    const get = (k) => form.get(k);
    const file = form.get('image');
    if (file && typeof file === 'object' && file.size > 0) assertImageFile(file);

    let imageId = null;
    if (file && typeof file === 'object' && file.size > 0) {
      imageId = await saveFileToGridFS(file);
    }

    const sortOrder = get('sortOrder');
    const material = await Material.create({
      siteId,
      key: get('key'),
      group: get('group'),
      nameEn: get('nameEn'),
      nameAr: get('nameAr'),
      specEn: get('specEn') || '',
      specAr: get('specAr') || '',
      sortOrder: sortOrder !== null && sortOrder !== undefined ? Number(sortOrder) : 0,
      imageId,
    });

    return Response.json(material, { status: 201 });
  } catch (err) {
    return Response.json(
      { message: 'Error creating material', error: err.message },
      { status: 400 }
    );
  }
}
