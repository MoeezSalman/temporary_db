/**
 * Backfill unique publicSlug on branding docs that have null/missing slug.
 * Fixes: E11000 duplicate key error index: publicSlug_1 dup key: { publicSlug: null }
 *
 * Usage (from backend folder, with MONGO_URI set):
 *   node scripts/fixPublicSlugs.js
 */
import mongoose from 'mongoose';
import crypto from 'crypto';

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) {
  console.error('Set MONGO_URI');
  process.exit(1);
}

function slugFor(userId) {
  const suffix = crypto.randomBytes(4).toString('hex');
  const base = userId ? String(userId).slice(-6) : crypto.randomBytes(3).toString('hex');
  return `u-${base}-${suffix}`;
}

await mongoose.connect(uri);
const col = mongoose.connection.collection('brandings');

const broken = await col
  .find({ $or: [{ publicSlug: null }, { publicSlug: { $exists: false } }, { publicSlug: '' }] })
  .toArray();

console.log(`Found ${broken.length} branding doc(s) without publicSlug`);

for (const doc of broken) {
  const publicSlug = slugFor(doc.userId);
  await col.updateOne({ _id: doc._id }, { $set: { publicSlug } });
  console.log(`  fixed ${doc._id} -> ${publicSlug}`);
}

console.log('Done');
await mongoose.disconnect();
