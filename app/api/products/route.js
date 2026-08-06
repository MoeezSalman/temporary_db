import { connectDB } from '@/lib/db';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth';
import { saveFilesToGridFS, assertImageFile } from '@/lib/gridfs';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');

    const query = {};
    if (category) query.category = category;
    if (featured !== null && featured !== undefined) {
      query.isFeatured = featured === 'true';
    }

    const products = await Product.find(query).sort({ createdAt: -1 }).lean();
    return Response.json(products, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    return Response.json(
      { message: 'Error fetching products', error: err.message },
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
    const files = form.getAll('images').filter((f) => f && typeof f === 'object' && f.size > 0);
    for (const f of files) assertImageFile(f);

    let imageIds = [];
    if (files.length > 0) {
      imageIds = await saveFilesToGridFS(files);
    }

    const product = await Product.create({
      titleEn: get('titleEn'),
      titleAr: get('titleAr'),
      descriptionEn: get('descriptionEn') || '',
      descriptionAr: get('descriptionAr') || '',
      price: Number(get('price')),
      category: get('category'),
      categoryAr: get('categoryAr') || '',
      materialsEn: get('materialsEn') || '',
      materialsAr: get('materialsAr') || '',
      dimensionsEn: get('dimensionsEn') || '',
      dimensionsAr: get('dimensionsAr') || '',
      isNewArrival: get('isNewArrival') === 'true' || get('isNewArrival') === true,
      isFeatured: get('isFeatured') === 'true' || get('isFeatured') === true,
      imageIds,
    });

    return Response.json(product, { status: 201 });
  } catch (err) {
    return Response.json(
      { message: 'Error creating product', error: err.message },
      { status: 400 }
    );
  }
}
