import { connectDB } from '@/lib/db';
import SiteAsset from '@/models/SiteAsset';
import { requireAdmin } from '@/lib/auth';
import { saveFileToGridFS, deleteFileFromGridFS, assertImageFile } from '@/lib/gridfs';

export async function GET(_request, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    // Support lookup by Mongo id OR by stable key string
    let asset = null;
    if (/^[a-f0-9]{24}$/i.test(id)) {
      asset = await SiteAsset.findById(id).lean();
    }
    if (!asset) {
      asset = await SiteAsset.findOne({ key: decodeURIComponent(id) }).lean();
    }
    if (!asset) {
      return Response.json({ message: 'Site asset not found' }, { status: 404 });
    }
    return Response.json(asset);
  } catch (err) {
    return Response.json(
      { message: 'Error fetching site asset', error: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { id } = await params;
    const asset = await SiteAsset.findById(id);
    if (!asset) {
      return Response.json({ message: 'Site asset not found' }, { status: 404 });
    }

    const form = await request.formData();
    const get = (k) => form.get(k);

    for (const f of [
      'key',
      'group',
      'titleEn',
      'titleAr',
      'descriptionEn',
      'descriptionAr',
      'category',
      'categoryAr',
    ]) {
      const v = get(f);
      if (v !== null && v !== undefined) asset[f] = v;
    }
    if (get('sortOrder') !== null) asset.sortOrder = Number(get('sortOrder'));

    const file = form.get('image');
    if (file && typeof file === 'object' && file.size > 0) {
      assertImageFile(file);
      const oldId = asset.imageId;
      asset.imageId = await saveFileToGridFS(file);
      if (oldId) await deleteFileFromGridFS(oldId);
    }

    await asset.save();
    return Response.json(asset);
  } catch (err) {
    return Response.json(
      { message: 'Error updating site asset', error: err.message },
      { status: 400 }
    );
  }
}

export async function DELETE(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { id } = await params;
    const asset = await SiteAsset.findById(id);
    if (!asset) {
      return Response.json({ message: 'Site asset not found' }, { status: 404 });
    }
    if (asset.imageId) await deleteFileFromGridFS(asset.imageId);
    await asset.deleteOne();
    return Response.json({ message: 'Site asset deleted' });
  } catch (err) {
    return Response.json(
      { message: 'Error deleting site asset', error: err.message },
      { status: 500 }
    );
  }
}
