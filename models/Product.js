import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    titleEn: { type: String, required: true },
    titleAr: { type: String, required: true },
    descriptionEn: { type: String, default: '' },
    descriptionAr: { type: String, default: '' },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    categoryAr: { type: String, default: '' },
    materialsEn: { type: String, default: '' },
    materialsAr: { type: String, default: '' },
    dimensionsEn: { type: String, default: '' },
    dimensionsAr: { type: String, default: '' },
    isNewArrival: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    imageIds: [{ type: mongoose.Schema.Types.ObjectId }],
  },
  { timestamps: true }
);

export default mongoose.models.Product || mongoose.model('Product', productSchema);
