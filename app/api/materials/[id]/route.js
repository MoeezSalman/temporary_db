import { connectDB } from '@/lib/db';
import Material from '@/models/Material';
import { requireAdmin } from '@/lib/auth';
import { saveFileToGridFS, deleteFileFromGridFS, assertImageFile } from '@/lib/gridfs';

export async function GET(_request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const material = await Material.findById(id).lean();
    if (!material) {
      return Response.json({ message: 'Material not found' }, { status: 404 });
    }
    return Response.json(material);
  } catch (err) {
    return Response.json(
      { message: 'Error fetching material', error: err.message },
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
    const material = await Material.findById(id);
    if (!material) {
      return Response.json({ message: 'Material not found' }, { status: 404 });
    }

    const form = await request.formData();
    const get = (k) => form.get(k);

    for (const f of ['key', 'group', 'nameEn', 'nameAr', 'specEn', 'specAr']) {
      const v = get(f);
      if (v !== null && v !== undefined) material[f] = v;
    }
    if (get('sortOrder') !== null) material.sortOrder = Number(get('sortOrder'));

    const file = form.get('image');
    if (file && typeof file === 'object' && file.size > 0) {
      assertImageFile(file);
      const oldImageId = material.imageId;
      material.imageId = await saveFileToGridFS(file);
      if (oldImageId) await deleteFileFromGridFS(oldImageId);
    }

    await material.save();
    return Response.json(material);
  } catch (err) {
    return Response.json(
      { message: 'Error updating material', error: err.message },
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
    const material = await Material.findById(id);
    if (!material) {
      return Response.json({ message: 'Material not found' }, { status: 404 });
    }
    if (material.imageId) await deleteFileFromGridFS(material.imageId);
    await material.deleteOne();
    return Response.json({ message: 'Material deleted' });
  } catch (err) {
    return Response.json(
      { message: 'Error deleting material', error: err.message },
      { status: 500 }
    );
  }
}
