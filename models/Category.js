import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    nameEn: { type: String, required: true },
    nameAr: { type: String, required: true },
    taglineEn: { type: String, default: '' },
    taglineAr: { type: String, default: '' },
    filter: { type: String, required: true, unique: true },
    aspectRatio: { type: String, default: 'standard' },
    imageId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Category || mongoose.model('Category', categorySchema);
