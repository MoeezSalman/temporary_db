import { connectDB } from '@/lib/db';
import Branding from '@/models/Branding';

// This route serves a per-user theme that changes any time the user updates
// their branding in the portal. It must never be cached (by Next.js's Full
// Route Cache/Data Cache, a CDN, or the browser) or the storefront link will
// keep showing the theme/logo that was live the first time this slug was
// ever requested instead of the latest one.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(_request, { params }) {
  try {
    await connectDB();
    const { slug } = await params;
    const branding = await Branding.findOne({ publicSlug: slug }).lean();
    if (!branding) {
      return Response.json(
        { message: 'Theme not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store, must-revalidate' } }
      );
    }
    return Response.json(
      {
        brandName: branding.brandName,
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        publicSlug: branding.publicSlug,
      },
      { headers: { 'Cache-Control': 'no-store, must-revalidate' } }
    );
  } catch (err) {
    return Response.json(
      { message: 'Error', error: err.message },
      { status: 500, headers: { 'Cache-Control': 'no-store, must-revalidate' } }
    );
  }
}
