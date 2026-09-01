import { connectDB } from '@/lib/db';
import Branding, { DEFAULTS } from '@/models/Branding';
import User from '@/models/User';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

async function resolveParams(params) {
  if (params && typeof params.then === 'function') return params;
  return params || {};
}

function toPlain(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') return doc.toObject({ flattenMaps: true });
  return doc;
}

function serialize(doc, user) {
  const raw = toPlain(doc) || {};
  return {
    _id: raw._id != null ? String(raw._id) : undefined,
    userId: raw.userId != null ? String(raw.userId) : undefined,
    brandName: raw.brandName || DEFAULTS.brandName,
    logoUrl: raw.logoUrl || null,
    primaryColor: raw.primaryColor || DEFAULTS.primaryColor,
    secondaryColor: raw.secondaryColor || DEFAULTS.secondaryColor,
    accentColor: raw.accentColor || DEFAULTS.accentColor,
    backgroundColor: raw.backgroundColor || DEFAULTS.backgroundColor,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    user: user
      ? { id: String(user._id), name: user.name, email: user.email }
      : undefined,
  };
}

async function getUser(id) {
  if (!isValidObjectId(String(id || ''))) {
    return { error: Response.json({ message: 'Invalid user id' }, { status: 400 }) };
  }
  const user = await User.findById(id).select('_id name email').lean();
  if (!user) {
    return { error: Response.json({ message: 'User not found' }, { status: 404 }) };
  }
  return { user };
}

async function ensureBranding(userId) {
  let doc = await Branding.findOne({ userId });
  if (doc) return doc;
  try {
    return await Branding.create({
      userId,
      brandName: DEFAULTS.brandName,
      logoUrl: null,
      primaryColor: DEFAULTS.primaryColor,
      secondaryColor: DEFAULTS.secondaryColor,
      accentColor: DEFAULTS.accentColor,
      backgroundColor: DEFAULTS.backgroundColor,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      doc = await Branding.findOne({ userId });
      if (doc) return doc;
    }
    throw err;
  }
}

/** GET /api/admin/user-branding/:id */
export async function GET(request, context) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { id } = await resolveParams(context?.params);
    const loaded = await getUser(id);
    if (loaded.error) return loaded.error;

    const branding = await ensureBranding(loaded.user._id);
    return Response.json(serialize(branding, loaded.user));
  } catch (err) {
    console.error('GET /api/admin/user-branding/:id', err);
    return Response.json(
      {
        message: 'Error fetching branding',
        error: err?.message || String(err),
        stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/** PUT /api/admin/user-branding/:id */
export async function PUT(request, context) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    await connectDB();
    const { id } = await resolveParams(context?.params);
    const loaded = await getUser(id);
    if (loaded.error) return loaded.error;

    const branding = await ensureBranding(loaded.user._id);

    if (body.brandName !== undefined) {
      branding.brandName = String(body.brandName).trim() || DEFAULTS.brandName;
    }
    if (body.logoUrl !== undefined) {
      if (body.logoUrl && String(body.logoUrl).length > 3500000) {
        return Response.json({ message: 'Logo too large' }, { status: 400 });
      }
      branding.logoUrl = body.logoUrl;
    }
    if (body.primaryColor !== undefined) branding.primaryColor = String(body.primaryColor);
    if (body.secondaryColor !== undefined) branding.secondaryColor = String(body.secondaryColor);
    if (body.accentColor !== undefined) branding.accentColor = String(body.accentColor);
    if (body.backgroundColor !== undefined) branding.backgroundColor = String(body.backgroundColor);

    await branding.save();
    return Response.json(serialize(branding, loaded.user));
  } catch (err) {
    console.error('PUT /api/admin/user-branding/:id', err);
    return Response.json(
      { message: 'Error updating branding', error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

/** POST /api/admin/user-branding/:id – reset defaults */
export async function POST(request, context) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await connectDB();
    const { id } = await resolveParams(context?.params);
    const loaded = await getUser(id);
    if (loaded.error) return loaded.error;

    const branding = await ensureBranding(loaded.user._id);
    branding.brandName = DEFAULTS.brandName;
    branding.logoUrl = null;
    branding.logoImageId = null;
    branding.primaryColor = DEFAULTS.primaryColor;
    branding.secondaryColor = DEFAULTS.secondaryColor;
    branding.accentColor = DEFAULTS.accentColor;
    branding.backgroundColor = DEFAULTS.backgroundColor;
    await branding.save();

    return Response.json(serialize(branding, loaded.user));
  } catch (err) {
    console.error('POST /api/admin/user-branding/:id', err);
    return Response.json(
      { message: 'Error resetting branding', error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
