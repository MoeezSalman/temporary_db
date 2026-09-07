import { connectDB } from '@/lib/db';
import Site from '@/models/Site';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/public/site/resolve?domain=...&slug=...
 * Dual-check: domain (Host / customDomain) AND/OR slug.
 * Returns siteId + branding if valid & active; 403 on mismatch; 404 if not found.
 */
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    let domain = (searchParams.get('domain') || '').toLowerCase().trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .split(':')[0]; // strip port
    let slug = (searchParams.get('slug') || '').toLowerCase().trim();

    // Also accept Host header as domain fallback
    const hostHeader = (request.headers.get('host') || '').toLowerCase().split(':')[0];
    if (!domain && hostHeader) domain = hostHeader;

    if (!domain && !slug) {
      return Response.json(
        { message: 'domain or slug is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let site = null;

    // Prefer exact customDomain match when domain provided
    if (domain) {
      site = await Site.findOne({
        $or: [
          { customDomain: domain },
          { customDomain: `www.${domain}` },
          { customDomain: domain.replace(/^www\./, '') },
        ],
        isActive: true,
      }).lean();
    }

    // Fall back / cross-check by slug
    if (!site && slug) {
      site = await Site.findOne({ slug, isActive: true }).lean();
    }

    if (!site) {
      return Response.json(
        { message: 'Store not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Dual-validation: if BOTH domain and slug provided, they must belong to same site
    if (domain && slug) {
      const domainMatches =
        site.customDomain === domain ||
        site.customDomain === `www.${domain}` ||
        (site.customDomain && site.customDomain.replace(/^www\./, '') === domain.replace(/^www\./, ''));
      const slugMatches = site.slug === slug;
      // If a customDomain is registered, domain must match it when both are sent.
      // If no customDomain, only slug is authoritative.
      if (site.customDomain && !domainMatches) {
        return Response.json(
          { message: 'Origin/Slug Mismatch' },
          { status: 403, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      if (!slugMatches) {
        return Response.json(
          { message: 'Origin/Slug Mismatch' },
          { status: 403, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    const branding = site.branding || {};
    return Response.json(
      {
        siteId: site._id,
        name: site.name,
        slug: site.slug,
        customDomain: site.customDomain || null,
        industryType: site.industryType,
        branding: {
          brandName: branding.brandName || site.name,
          logoUrl: branding.logoUrl || null,
          logoImageId: branding.logoImageId || null,
          primaryColor: branding.primaryColor,
          secondaryColor: branding.secondaryColor,
          accentColor: branding.accentColor,
          backgroundColor: branding.backgroundColor,
        },
      },
      { headers: { 'Cache-Control': 'no-store, must-revalidate' } }
    );
  } catch (err) {
    console.error('GET /api/public/site/resolve', err);
    return Response.json(
      { message: 'Error resolving site', error: err.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
