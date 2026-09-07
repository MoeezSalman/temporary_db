import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Site from '@/models/Site';
import Branding from '@/models/Branding';
import { requireAdmin } from '@/lib/auth';

/** GET /api/users/:id */
export async function GET(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { id } = await params;
    const user = await User.findById(id).select('-passwordHash').lean();
    if (!user) {
      return Response.json({ message: 'User not found' }, { status: 404 });
    }
    let site = null;
    if (user.siteId) {
      site = await Site.findById(user.siteId).lean();
    }
    return Response.json({
      ...user,
      site: site
        ? {
            _id: site._id,
            name: site.name,
            slug: site.slug,
            customDomain: site.customDomain,
            industryType: site.industryType,
            isActive: site.isActive,
          }
        : null,
    });
  } catch (err) {
    return Response.json({ message: 'Error fetching user', error: err.message }, { status: 500 });
  }
}

/** PUT /api/users/:id – update name, role, isActive, moduleAccess + site fields */
export async function PUT(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    await connectDB();
    const { id } = await params;

    const user = await User.findById(id);
    if (!user) {
      return Response.json({ message: 'User not found' }, { status: 404 });
    }

    if (body.name !== undefined) user.name = body.name.trim();
    if (body.role !== undefined) user.role = body.role === 'admin' ? 'admin' : 'user';
    if (body.isActive !== undefined) user.isActive = Boolean(body.isActive);
    if (body.moduleAccess !== undefined) user.moduleAccess = body.moduleAccess;

    // Site create / update
    const hasSiteFields =
      body.siteName !== undefined ||
      body.siteSlug !== undefined ||
      body.customDomain !== undefined ||
      body.industryType !== undefined;

    if (hasSiteFields) {
      let site = user.siteId ? await Site.findById(user.siteId) : null;

      if (!site) {
        // Create new site if name + slug provided
        if (!body.siteName || !body.siteSlug) {
          return Response.json(
            { message: 'siteName and siteSlug are required to create a store' },
            { status: 400 }
          );
        }
        const slug = String(body.siteSlug)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const existingSlug = await Site.findOne({ slug });
        if (existingSlug) {
          return Response.json({ message: 'Site slug already in use' }, { status: 409 });
        }
        const sitePayload = {
          ownerId: user._id,
          name: String(body.siteName).trim(),
          slug,
          industryType: (body.industryType || 'general').trim(),
          isActive: true,
          branding: { brandName: String(body.siteName).trim() },
        };
        if (body.customDomain && String(body.customDomain).trim()) {
          sitePayload.customDomain = String(body.customDomain)
            .toLowerCase()
            .trim()
            .replace(/^https?:\/\//, '')
            .replace(/\/+$/, '');
        }
        site = await Site.create(sitePayload);
        user.siteId = site._id;

        // Sync legacy Branding
        try {
          let branding = await Branding.findOne({ userId: user._id });
          if (!branding) {
            branding = new Branding({ userId: user._id, publicSlug: slug, brandName: site.name });
          } else {
            branding.publicSlug = slug;
            branding.brandName = site.name;
          }
          await branding.save();
        } catch (e) {
          console.warn('Branding sync', e.message);
        }
      } else {
        if (body.siteName !== undefined) {
          site.name = String(body.siteName).trim();
          if (site.branding) site.branding.brandName = site.name;
        }
        if (body.siteSlug !== undefined) {
          const slug = String(body.siteSlug)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-+|-+$/g, '');
          if (slug !== site.slug) {
            const existingSlug = await Site.findOne({ slug, _id: { $ne: site._id } });
            if (existingSlug) {
              return Response.json({ message: 'Site slug already in use' }, { status: 409 });
            }
            site.slug = slug;
            // Keep Branding publicSlug in sync
            await Branding.updateOne({ userId: user._id }, { publicSlug: slug });
          }
        }
        if (body.customDomain !== undefined) {
          const raw = body.customDomain && String(body.customDomain).trim()
            ? String(body.customDomain)
                .toLowerCase()
                .trim()
                .replace(/^https?:\/\//, '')
                .replace(/\/+$/, '')
            : undefined;
          if (raw) {
            const existingDom = await Site.findOne({
              customDomain: raw,
              _id: { $ne: site._id },
            });
            if (existingDom) {
              return Response.json({ message: 'Custom domain already in use' }, { status: 409 });
            }
            site.customDomain = raw;
          } else {
            site.customDomain = undefined;
            site.set('customDomain', undefined);
          }
        }
        if (body.industryType !== undefined) {
          site.industryType = String(body.industryType).trim();
        }
        await site.save();
      }
    }

    await user.save();

    const obj = user.toObject();
    delete obj.passwordHash;
    if (user.siteId) {
      const site = await Site.findById(user.siteId).lean();
      if (site) {
        obj.site = {
          _id: site._id,
          name: site.name,
          slug: site.slug,
          customDomain: site.customDomain,
          industryType: site.industryType,
          isActive: site.isActive,
        };
      }
    }

    return Response.json(obj);
  } catch (err) {
    console.error('PUT /api/users/:id', err);
    return Response.json({ message: 'Error updating user', error: err.message }, { status: 500 });
  }
}

/** DELETE /api/users/:id */
export async function DELETE(request, { params }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { id } = await params;

    const user = await User.findById(id);
    if (!user) {
      return Response.json({ message: 'User not found' }, { status: 404 });
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return Response.json(
          { message: 'Cannot delete the last admin user' },
          { status: 400 }
        );
      }
    }

    // Optionally leave Site in place (orphan) or soft-deactivate
    if (user.siteId) {
      await Site.updateOne({ _id: user.siteId }, { isActive: false });
    }

    await User.findByIdAndDelete(id);
    return Response.json({ message: 'User deleted successfully' });
  } catch (err) {
    return Response.json({ message: 'Error deleting user', error: err.message }, { status: 500 });
  }
}
