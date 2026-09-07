import { connectDB } from '@/lib/db';
import Product from '@/models/Product';
import { requireAdmin, resolveUserSite } from '@/lib/auth';
import { saveFilesToGridFS, deleteFileFromGridFS, assertImageFile } from '@/lib/gridfs';

export async function GET(_request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const product = await Product.findById(id).lean();
    if (!product) {
      return Response.json({ message: 'Product not found' }, { status: 404 });
    }
    return Response.json(product, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    return Response.json(
      { message: 'Error fetching product', error: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { siteId, errorResponse, decoded } = await resolveUserSite(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const product = await Product.findById(id);
    if (!product) {
      return Response.json({ message: 'Product not found' }, { status: 404 });
    }

    // Non-admin may only modify their own site's products
    const isAdmin = decoded.role === 'admin' || decoded.type === 'admin';
    if (!isAdmin && siteId && String(product.siteId) !== String(siteId)) {
      return Response.json({ message: 'Forbidden: product belongs to another store' }, { status: 403 });
    }

    const form = await request.formData();
    const get = (k) => form.get(k);

    const fields = [
      'titleEn',
      'titleAr',
      'descriptionEn',
      'descriptionAr',
      'category',
      'categoryAr',
      'materialsEn',
      'materialsAr',
      'dimensionsEn',
      'dimensionsAr',
    ];
    for (const f of fields) {
      const v = get(f);
      if (v !== null && v !== undefined) product[f] = v;
    }
    if (get('price') !== null) product.price = Number(get('price'));
    if (get('isNewArrival') !== null) {
      product.isNewArrival = get('isNewArrival') === 'true';
    }
    if (get('isFeatured') !== null) {
      product.isFeatured = get('isFeatured') === 'true';
    }

    const removeRaw = get('removeImageIds');
    if (removeRaw) {
      let toRemove = removeRaw;
      if (typeof toRemove === 'string') {
        try {
          toRemove = JSON.parse(toRemove);
        } catch {
          toRemove = toRemove.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      if (Array.isArray(toRemove) && toRemove.length) {
        for (const rid of toRemove) await deleteFileFromGridFS(rid);
        product.imageIds = product.imageIds.filter(
          (oid) => !toRemove.includes(String(oid))
        );
      }
    }

    const files = form.getAll('images').filter((f) => f && typeof f === 'object' && f.size > 0);
    for (const f of files) assertImageFile(f);

    if (files.length > 0) {
      const newIds = await saveFilesToGridFS(files);
      if (get('replaceImages') === 'true') {
        for (const oldId of product.imageIds) await deleteFileFromGridFS(oldId);
        product.imageIds = newIds;
      } else {
        product.imageIds = [...product.imageIds, ...newIds];
      }
    }

    await product.save();
    return Response.json(product);
  } catch (err) {
    return Response.json(
      { message: 'Error updating product', error: err.message },
      { status: 400 }
    );
  }
}

export async function DELETE(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { siteId, errorResponse, decoded } = await resolveUserSite(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const product = await Product.findById(id);
    if (!product) {
      return Response.json({ message: 'Product not found' }, { status: 404 });
    }

    const isAdmin = decoded.role === 'admin' || decoded.type === 'admin';
    if (!isAdmin && siteId && String(product.siteId) !== String(siteId)) {
      return Response.json({ message: 'Forbidden: product belongs to another store' }, { status: 403 });
    }

    for (const imgId of product.imageIds || []) {
      await deleteFileFromGridFS(imgId);
    }
    await product.deleteOne();
    return Response.json({ message: 'Product deleted' });
  } catch (err) {
    return Response.json(
      { message: 'Error deleting product', error: err.message },
      { status: 500 }
    );
  }
}
