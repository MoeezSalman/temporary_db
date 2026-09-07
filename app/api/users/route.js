import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Site from '@/models/Site';
import Branding from '@/models/Branding';
import { requireAdmin } from '@/lib/auth';
import { generatePublicSlug } from '@/models/Branding';

/** GET /api/users – list all users (admin only) + their site summary */
export async function GET(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const users = await User.find({})
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();

    // Attach site info for each user
    const siteIds = users.map((u) => u.siteId).filter(Boolean);
    const sites = siteIds.length
      ? await Site.find({ _id: { $in: siteIds } }).lean()
      : [];
    const siteMap = Object.fromEntries(sites.map((s) => [String(s._id), s]));

    const enriched = users.map((u) => {
      const site = u.siteId ? siteMap[String(u.siteId)] : null;
      return {
        ...u,
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
      };
    });

    return Response.json(enriched);
  } catch (err) {
    return Response.json(
      { message: 'Error fetching users', error: err.message },
      { status: 500 }
    );
  }
}

/** POST /api/users – create a new user + optional Site (admin only) */
export async function POST(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    name,
    email,
    password,
    role = 'user',
    moduleAccess,
    // Site fields
    siteName,
    siteSlug,
    customDomain,
    industryType,
  } = body || {};

  if (!name || !email || !password) {
    return Response.json(
      { message: 'name, email and password are required' },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return Response.json(
      { message: 'Password must be at least 6 characters' },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return Response.json({ message: 'A user with this email already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role === 'admin' ? 'admin' : 'user',
      moduleAccess: moduleAccess || { material: true, product: true, categories: true },
      isActive: true,
    });

    let site = null;
    // Create Site when siteName + siteSlug provided (typical for store owners)
    if (siteName && siteSlug) {
      const slug = String(siteSlug)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const existingSlug = await Site.findOne({ slug });
      if (existingSlug) {
        await User.findByIdAndDelete(user._id);
        return Response.json({ message: 'Site slug already in use' }, { status: 409 });
      }
      if (customDomain) {
        const dom = String(customDomain)
          .toLowerCase()
          .trim()
          .replace(/^https?:\/\//, '')
          .replace(/\/+$/, '');
        const existingDom = await Site.findOne({ customDomain: dom });
        if (existingDom) {
          await User.findByIdAndDelete(user._id);
          return Response.json({ message: 'Custom domain already in use' }, { status: 409 });
        }
      }

      const sitePayload = {
        ownerId: user._id,
        name: siteName.trim(),
        slug,
        industryType: (industryType || 'general').trim(),
        isActive: true,
        branding: {
          brandName: siteName.trim(),
        },
      };
      // Only set customDomain when a real value is provided (omit key for sparse unique index)
      if (customDomain && String(customDomain).trim()) {
        sitePayload.customDomain = String(customDomain)
          .toLowerCase()
          .trim()
          .replace(/^https?:\/\//, '')
          .replace(/\/+$/, '');
      }
      site = await Site.create(sitePayload);

      user.siteId = site._id;
      await user.save();

      // Also create legacy Branding record so existing branding APIs keep working
      try {
        await Branding.create({
          userId: user._id,
          publicSlug: slug,
          brandName: siteName.trim(),
        });
      } catch (e) {
        // non-fatal if branding already exists
        console.warn('Branding create on user create:', e.message);
      }
    }

    const obj = user.toObject();
    delete obj.passwordHash;
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

    return Response.json(obj, { status: 201 });
  } catch (err) {
    console.error('POST /api/users', err);
    return Response.json(
      { message: 'Error creating user', error: err.message },
      { status: 500 }
    );
  }
}
