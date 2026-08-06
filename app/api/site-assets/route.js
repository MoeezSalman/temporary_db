import { connectDB } from '@/lib/db';
import SiteAsset from '@/models/SiteAsset';
import { requireAdmin } from '@/lib/auth';
import { saveFileToGridFS, assertImageFile } from '@/lib/gridfs';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const query = {};
    if (searchParams.get('group')) query.group = searchParams.get('group');
    if (searchParams.get('key')) query.key = searchParams.get('key');

    const assets = await SiteAsset.find(query)
      .sort({ group: 1, sortOrder: 1, createdAt: 1 })
      .lean();
    return Response.json(assets);
  } catch (err) {
    return Response.json(
      { message: 'Error fetching site assets', error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const form = await request.formData();
    const get = (k) => form.get(k);
    const file = form.get('image');
    if (file && typeof file === 'object' && file.size > 0) assertImageFile(file);

    let imageId = null;
    if (file && typeof file === 'object' && file.size > 0) {
      imageId = await saveFileToGridFS(file);
    }

    const sortOrder = get('sortOrder');
    const asset = await SiteAsset.create({
      key: get('key'),
      group: get('group'),
      titleEn: get('titleEn') || '',
      titleAr: get('titleAr') || '',
      descriptionEn: get('descriptionEn') || '',
      descriptionAr: get('descriptionAr') || '',
      category: get('category') || '',
      categoryAr: get('categoryAr') || '',
      sortOrder: sortOrder !== null && sortOrder !== undefined ? Number(sortOrder) : 0,
      imageId,
    });

    return Response.json(asset, { status: 201 });
  } catch (err) {
    return Response.json(
      { message: 'Error creating site asset', error: err.message },
      { status: 400 }
    );
  }
}
