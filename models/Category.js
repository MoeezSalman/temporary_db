import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: false,
      index: true,
    },
    nameEn: { type: String, required: true },
    nameAr: { type: String, required: true },
    taglineEn: { type: String, default: '' },
    taglineAr: { type: String, default: '' },
    filter: { type: String, required: true },
    aspectRatio: { type: String, default: 'standard' },
    imageId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

// filter unique per site (not globally)
categorySchema.index({ siteId: 1, filter: 1 }, { unique: true });

export default mongoose.models.Category || mongoose.model('Category', categorySchema);
