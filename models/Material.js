import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
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

export default mongoose.models.Material || mongoose.model('Material', materialSchema);
