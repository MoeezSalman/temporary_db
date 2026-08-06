import { connectDB } from '@/lib/db';
import Category from '@/models/Category';
import { requireAdmin } from '@/lib/auth';
import { saveFileToGridFS, deleteFileFromGridFS, assertImageFile } from '@/lib/gridfs';

export async function GET(_request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const category = await Category.findById(id).lean();
    if (!category) {
      return Response.json({ message: 'Category not found' }, { status: 404 });
    }
    return Response.json(category);
  } catch (err) {
    return Response.json(
      { message: 'Error fetching category', error: err.message },
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
    const category = await Category.findById(id);
    if (!category) {
      return Response.json({ message: 'Category not found' }, { status: 404 });
    }

    const form = await request.formData();
    const get = (k) => form.get(k);

    for (const f of ['nameEn', 'nameAr', 'taglineEn', 'taglineAr', 'filter', 'aspectRatio']) {
      const v = get(f);
      if (v !== null && v !== undefined) category[f] = v;
    }

    const file = form.get('image');
    if (file && typeof file === 'object' && file.size > 0) {
      assertImageFile(file);
      const oldImageId = category.imageId;
      category.imageId = await saveFileToGridFS(file);
      if (oldImageId) await deleteFileFromGridFS(oldImageId);
    }

    await category.save();
    return Response.json(category);
  } catch (err) {
    return Response.json(
      { message: 'Error updating category', error: err.message },
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
    const category = await Category.findById(id);
    if (!category) {
      return Response.json({ message: 'Category not found' }, { status: 404 });
    }
    if (category.imageId) await deleteFileFromGridFS(category.imageId);
    await category.deleteOne();
    return Response.json({ message: 'Category deleted' });
  } catch (err) {
    return Response.json(
      { message: 'Error deleting category', error: err.message },
      { status: 500 }
    );
  }
}
