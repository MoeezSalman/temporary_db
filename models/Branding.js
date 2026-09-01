import mongoose from 'mongoose';
import crypto from 'crypto';

const DEFAULTS = {
  brandName: 'Rua Sadiq',
  logoUrl: null,
  primaryColor: '#f59e0b',
  secondaryColor: '#0f172a',
  accentColor: '#fbbf24',
  backgroundColor: '#020617',
};

const brandingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Unique public link slug. Must never be null when unique index exists in DB.
    // sparse: true so missing values don't collide — but we always set a value on create.
    publicSlug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    brandName: { type: String, default: DEFAULTS.brandName },
    logoUrl: { type: String, default: null },
    logoImageId: { type: mongoose.Schema.Types.ObjectId, default: null },
    primaryColor: { type: String, default: DEFAULTS.primaryColor },
    secondaryColor: { type: String, default: DEFAULTS.secondaryColor },
    accentColor: { type: String, default: DEFAULTS.accentColor },
    backgroundColor: { type: String, default: DEFAULTS.backgroundColor },
  },
  { timestamps: true }
);

/** Short unique slug for public theme links */
export function generatePublicSlug(userId) {
  const suffix = crypto.randomBytes(4).toString('hex');
  const base = userId ? String(userId).slice(-6) : 'theme';
  return `u-${base}-${suffix}`;
}

export { DEFAULTS };

const Branding =
  mongoose.models.Branding || mongoose.model('Branding', brandingSchema);

export default Branding;
