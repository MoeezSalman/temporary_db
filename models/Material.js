import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: false,
      index: true,
    },
    key: { type: String, required: true },
    group: {
      type: String,
      required: true,
      enum: ['sofa', 'curtain', 'wood', 'foam'],
    },
    nameEn: { type: String, required: true },
    nameAr: { type: String, required: true },
    specEn: { type: String, default: '' },
    specAr: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    imageId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

// key unique per site
materialSchema.index({ siteId: 1, key: 1 }, { unique: true });

export default mongoose.models.Material || mongoose.model('Material', materialSchema);
