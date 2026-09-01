import mongoose from 'mongoose';

const moduleAccessSchema = new mongoose.Schema(
  {
    material: { type: Boolean, default: true },
    product: { type: Boolean, default: true },
    categories: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    moduleAccess: { type: moduleAccessSchema, default: () => ({ material: true, product: true, categories: true }) },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);
