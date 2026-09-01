import { connectDB } from '@/lib/db';
import Branding, { DEFAULTS, generatePublicSlug } from '@/models/Branding';
import User from '@/models/User';
import { getAdminFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function unauthorized() {
  return Response.json({ message: 'No token provided or invalid token' }, { status: 401 });
}

function isObjectId(str) {
  return typeof str === 'string' && /^[a-fA-F0-9]{24}$/.test(str);
}

function resolveSelfUserId(decoded) {
  if (!decoded) return null;
  const raw = decoded.id || decoded._id || decoded.userId || decoded.sub;
  if (!raw) return null;
  const str = String(raw);
  if (!isObjectId(str)) return null;
  return new mongoose.Types.ObjectId(str);
}

function isAdminToken(decoded) {
  if (!decoded) return false;
  return (
    decoded.role === 'admin' ||
    decoded.type === 'admin' ||
    decoded.username === 'admin'
  );
}

async function resolveTargetUserId(request, decoded, body = null) {
  const selfId = resolveSelfUserId(decoded);
  const url = new URL(request.url);
  const queryUserId = url.searchParams.get('userId') || url.searchParams.get('targetUserId');
  const bodyUserId = body?.userId || body?.targetUserId || body?.forUserId || null;
  const requested = queryUserId || bodyUserId;

  if (requested) {
    if (!isAdminToken(decoded)) {
      if (!selfId || String(selfId) !== String(requested)) {
        return { error: Response.json({ message: 'Forbidden' }, { status: 403 }) };
      }
      return { userId: selfId };
    }
    if (!isObjectId(String(requested))) {
      return { error: Response.json({ message: 'Invalid userId' }, { status: 400 }) };
    }
    const target = new mongoose.Types.ObjectId(String(requested));
    const exists = await User.findById(target).select('_id').lean();
    if (!exists) {
      return { error: Response.json({ message: 'User not found' }, { status: 404 }) };
    }
    return { userId: target };
  }

  if (!selfId) {
    if (isAdminToken(decoded)) {
      return {
        error: Response.json(
          { message: 'userId query/body is required for admin to manage a user theme' },
          { status: 400 }
        ),
      };
    }
    return { error: unauthorized() };
  }

  return { userId: selfId };
}

function serialize(branding) {
  const raw = branding?.toObject ? branding.toObject() : branding || {};
  return {
    _id: raw._id != null ? String(raw._id) : undefined,
    userId: raw.userId != null ? String(raw.userId) : undefined,
    publicSlug: raw.publicSlug || null,
    brandName: raw.brandName ?? DEFAULTS.brandName,
    logoUrl: raw.logoUrl ?? null,
    logoImageId: raw.logoImageId != null ? String(raw.logoImageId) : null,
    primaryColor: raw.primaryColor ?? DEFAULTS.primaryColor,
    secondaryColor: raw.secondaryColor ?? DEFAULTS.secondaryColor,
    accentColor: raw.accentColor ?? DEFAULTS.accentColor,
    backgroundColor: raw.backgroundColor ?? DEFAULTS.backgroundColor,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

/**
 * Ensure branding exists for userId.
 * Always assigns a unique publicSlug to avoid E11000 on publicSlug_1 (null).
 * Also backfills publicSlug on legacy docs that have null/missing slug.
 */
async function getOrCreate(userId) {
  let branding = await Branding.findOne({ userId });

  if (branding) {
    if (!branding.publicSlug) {
      branding.publicSlug = generatePublicSlug(userId);
      try {
        await branding.save();
      } catch (err) {
        if (err?.code === 11000) {
          branding.publicSlug = generatePublicSlug(userId);
          await branding.save();
        } else {
          throw err;
        }
      }
    }
    return branding;
  }

  // Create with unique publicSlug (retry once on rare slug collision)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      branding = await Branding.create({
        userId,
        publicSlug: generatePublicSlug(userId),
        brandName: DEFAULTS.brandName,
        logoUrl: null,
        primaryColor: DEFAULTS.primaryColor,
        secondaryColor: DEFAULTS.secondaryColor,
        accentColor: DEFAULTS.accentColor,
        backgroundColor: DEFAULTS.backgroundColor,
      });
      return branding;
    } catch (err) {
      if (err?.code === 11000) {
        // Either concurrent create for same userId, or slug clash
        const existing = await Branding.findOne({ userId });
        if (existing) {
          if (!existing.publicSlug) {
            existing.publicSlug = generatePublicSlug(userId);
            try {
              await existing.save();
            } catch {
              /* ignore secondary slug race */
            }
          }
          return existing;
        }
        continue;
      }
      throw err;
    }
  }

  throw new Error('Could not create branding after retries');
}

/** GET /api/branding/me  (?userId= for admin) */
export async function GET(request) {
  const decoded = getAdminFromRequest(request);
  if (!decoded) return unauthorized();

  try {
    await connectDB();
    const target = await resolveTargetUserId(request, decoded, null);
    if (target.error) return target.error;

    const branding = await getOrCreate(target.userId);
    return Response.json(serialize(branding));
  } catch (err) {
    console.error('GET /api/branding/me', err);
    return Response.json({ message: 'Error fetching branding', error: err.message }, { status: 500 });
  }
}

/** PUT /api/branding/me  (?userId= or body.userId for admin) */
export async function PUT(request) {
  const decoded = getAdminFromRequest(request);
  if (!decoded) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    await connectDB();
    const target = await resolveTargetUserId(request, decoded, body);
    if (target.error) return target.error;

    const branding = await getOrCreate(target.userId);

    if (body.brandName !== undefined) {
      branding.brandName = String(body.brandName).trim() || DEFAULTS.brandName;
    }
    if (body.logoUrl !== undefined) {
      if (body.logoUrl && String(body.logoUrl).length > 3500000) {
        return Response.json({ message: 'Logo too large' }, { status: 400 });
      }
      branding.logoUrl = body.logoUrl;
    }
    if (body.primaryColor !== undefined) branding.primaryColor = body.primaryColor;
    if (body.secondaryColor !== undefined) branding.secondaryColor = body.secondaryColor;
    if (body.accentColor !== undefined) branding.accentColor = body.accentColor;
    if (body.backgroundColor !== undefined) branding.backgroundColor = body.backgroundColor;

    if (!branding.publicSlug) {
      branding.publicSlug = generatePublicSlug(target.userId);
    }

    await branding.save();
    return Response.json(serialize(branding));
  } catch (err) {
    console.error('PUT /api/branding/me', err);
    return Response.json({ message: 'Error updating branding', error: err.message }, { status: 500 });
  }
}
