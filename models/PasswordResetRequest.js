import mongoose from 'mongoose';

const passwordResetRequestSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending',
      index: true,
    },
    resolvedBy: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    note: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.PasswordResetRequest ||
  mongoose.model('PasswordResetRequest', passwordResetRequestSchema);
