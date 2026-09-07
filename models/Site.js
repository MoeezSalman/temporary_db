import mongoose from 'mongoose';

const brandingSchema = new mongoose.Schema(
  {
    brandName: { type: String, default: 'Store' },
    logoUrl: { type: String, default: null },
    logoImageId: { type: mongoose.Schema.Types.ObjectId, default: null },
    primaryColor: { type: String, default: '#f59e0b' },
    secondaryColor: { type: String, default: '#0f172a' },
    accentColor: { type: String, default: '#fbbf24' },
    backgroundColor: { type: String, default: '#020617' },
  },
  { _id: false }
);

const siteSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // sparse unique: multiple docs can omit this field; only real domains must be unique
    customDomain: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      // no default: null — omit field when empty so sparse index works
    },
    industryType: { type: String, default: 'general', trim: true },
    isActive: { type: Boolean, default: true },
    branding: { type: brandingSchema, default: () => ({}) },
  },
  { timestamps: true }
);

siteSchema.pre('validate', function () {
  if (this.slug) {
    this.slug = String(this.slug)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (this.customDomain) {
    this.customDomain = String(this.customDomain)
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');
  } else {
    // ensure empty string / null does not get stored (breaks sparse unique)
    this.customDomain = undefined;
  }
});

const Site = mongoose.models.Site || mongoose.model('Site', siteSchema);

export default Site;
