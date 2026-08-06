import { connectDB } from '@/lib/db';
import Category from '@/models/Category';
import { requireAdmin } from '@/lib/auth';
import { saveFileToGridFS, assertImageFile } from '@/lib/gridfs';

export async function GET() {
  try {
    await connectDB();
    const categories = await Category.find().sort({ createdAt: 1 }).lean();
    return Response.json(categories, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    return Response.json(
      { message: 'Error fetching categories', error: err.message },
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

    const category = await Category.create({
      nameEn: get('nameEn'),
      nameAr: get('nameAr'),
      taglineEn: get('taglineEn') || '',
      taglineAr: get('taglineAr') || '',
      filter: get('filter'),
      aspectRatio: get('aspectRatio') || 'standard',
      imageId,
    });

    return Response.json(category, { status: 201 });
  } catch (err) {
    return Response.json(
      { message: 'Error creating category', error: err.message },
      { status: 400 }
    );
  }
}
