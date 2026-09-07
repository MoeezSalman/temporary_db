import { connectDB } from '@/lib/db';
import Site from '@/models/Site';
import Product from '@/models/Product';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/public/:slug/products
 * Cross-verify origin/domain matches the store owning :slug, then return only that site's products.
 * Query params: category, featured (same as legacy)
 */
export async function GET(request, { params }) {
  try {
    await connectDB();
    const { slug: rawSlug } = await params;
    const slug = String(rawSlug || '').toLowerCase().trim();
    if (!slug) {
      return Response.json({ message: 'slug required' }, { status: 400 });
    }

    const site = await Site.findOne({ slug, isActive: true }).lean();
    if (!site) {
      return Response.json({ message: 'Store not found' }, { status: 404 });
    }

    // Optional dual-check against Host / domain query
    const { searchParams } = new URL(request.url);
    let domain = (searchParams.get('domain') || '').toLowerCase().trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .split(':')[0];
    const hostHeader = (request.headers.get('host') || '').toLowerCase().split(':')[0];
    if (!domain && hostHeader) domain = hostHeader;

    if (domain && site.customDomain) {
      const domainMatches =
        site.customDomain === domain ||
        site.customDomain === `www.${domain}` ||
        site.customDomain.replace(/^www\./, '') === domain.replace(/^www\./, '');
      // Only enforce strict mismatch when a custom domain is configured
      // and the request is clearly coming from a different public host
      // (skip localhost / platform default hosts)
      const isLocalOrPlatform =
        !domain ||
        domain.includes('localhost') ||
        domain.includes('127.0.0.1') ||
        domain.includes('yourplatform') ||
        domain.endsWith('.vercel.app') ||
        domain.endsWith('.onrender.com');
      if (!isLocalOrPlatform && !domainMatches) {
        return Response.json(
          { message: 'Origin/Slug Mismatch' },
          { status: 403 }
        );
      }
    }

    const query = { siteId: site._id };
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
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
    console.error('GET /api/public/:slug/products', err);
    return Response.json(
      { message: 'Error fetching products', error: err.message },
      { status: 500 }
    );
  }
}
