import { connectDB } from '@/lib/db';
import Branding, { DEFAULTS, generatePublicSlug } from '@/models/Branding';
import User from '@/models/User';
import { getAdminFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

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
  return decoded.role === 'admin' || decoded.type === 'admin' || decoded.username === 'admin';
}

async function resolveTargetUserId(request, decoded) {
  const selfId = resolveSelfUserId(decoded);
  const url = new URL(request.url);
  const queryUserId = url.searchParams.get('userId') || url.searchParams.get('targetUserId');

  if (queryUserId) {
    if (!isAdminToken(decoded)) {
      if (!selfId || String(selfId) !== String(queryUserId)) {
        return { error: Response.json({ message: 'Forbidden' }, { status: 403 }) };
      }
      return { userId: selfId };
    }
    if (!isObjectId(String(queryUserId))) {
      return { error: Response.json({ message: 'Invalid userId' }, { status: 400 }) };
    }
    const target = new mongoose.Types.ObjectId(String(queryUserId));
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
          { message: 'userId query is required for admin to reset a user theme' },
          { status: 400 }
        ),
      };
    }
    return { error: Response.json({ message: 'Unauthorized' }, { status: 401 }) };
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

/** POST /api/branding/me/reset (?userId= for admin) */
export async function POST(request) {
  const decoded = getAdminFromRequest(request);
  if (!decoded) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const target = await resolveTargetUserId(request, decoded);
    if (target.error) return target.error;

    let branding = await Branding.findOne({ userId: target.userId });
    if (!branding) {
      branding = await Branding.create({
        userId: target.userId,
        publicSlug: generatePublicSlug(target.userId),
        brandName: DEFAULTS.brandName,
        logoUrl: null,
        primaryColor: DEFAULTS.primaryColor,
        secondaryColor: DEFAULTS.secondaryColor,
        accentColor: DEFAULTS.accentColor,
        backgroundColor: DEFAULTS.backgroundColor,
      });
    } else {
      branding.brandName = DEFAULTS.brandName;
      branding.logoUrl = null;
      branding.logoImageId = null;
      branding.primaryColor = DEFAULTS.primaryColor;
      branding.secondaryColor = DEFAULTS.secondaryColor;
      branding.accentColor = DEFAULTS.accentColor;
      branding.backgroundColor = DEFAULTS.backgroundColor;
      if (!branding.publicSlug) {
        branding.publicSlug = generatePublicSlug(target.userId);
      }
      await branding.save();
    }

    return Response.json(serialize(branding));
  } catch (err) {
    console.error('POST /api/branding/me/reset', err);
    return Response.json({ message: 'Error resetting', error: err.message }, { status: 500 });
  }
}
