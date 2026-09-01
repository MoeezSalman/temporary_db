/**
 * One-time cleanup: remove Branding documents that have no valid userId
 * (legacy global branding records) or are orphaned.
 *
 * Usage: node scripts/cleanupBranding.js
 * Requires MONGODB_URI in env.
 */
import mongoose from 'mongoose';
import Branding from '../models/Branding.js';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error('Set MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(uri);
const result = await Branding.deleteMany({
  $or: [{ userId: { $exists: false } }, { userId: null }],
});
console.log(`Removed ${result.deletedCount} orphan branding record(s) without userId`);
await mongoose.disconnect();
