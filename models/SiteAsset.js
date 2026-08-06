import mongoose from 'mongoose';

const siteAssetSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    group: {
      type: String,
      required: true,
      enum: ['hero', 'banner', 'craft', 'studio', 'ugc', 'logo', 'decorative'],
      index: true,
    },
    titleEn: { type: String, default: '' },
    titleAr: { type: String, default: '' },
    descriptionEn: { type: String, default: '' },
    descriptionAr: { type: String, default: '' },
    category: { type: String, default: '' },
    categoryAr: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    imageId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.SiteAsset || mongoose.model('SiteAsset', siteAssetSchema);
