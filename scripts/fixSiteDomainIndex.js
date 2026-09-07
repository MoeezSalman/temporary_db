/**
 * One-time fix: drop the non-sparse customDomain unique index that
 * rejects multiple nulls, then let Mongoose recreate a sparse one.
 *
 * Run: node scripts/fixSiteDomainIndex.js
 * (from the backend folder, with MONGODB_URI / .env loaded)
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error('Set MONGODB_URI in .env');
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('sites');
  const indexes = await col.indexes();
  console.log('Current indexes:', indexes.map((i) => i.name));

  // Drop any customDomain unique index that is not sparse
  for (const idx of indexes) {
    if (idx.key && idx.key.customDomain === 1) {
      console.log('Dropping index:', idx.name, 'sparse=', idx.sparse);
      await col.dropIndex(idx.name);
    }
  }

  // Recreate sparse unique index
  await col.createIndex(
    { customDomain: 1 },
    { unique: true, sparse: true, name: 'customDomain_1' }
  );
  console.log('Recreated sparse unique index on customDomain');

  // Optional: unset null customDomain fields so they don't exist on docs
  const result = await col.updateMany(
    { customDomain: null },
    { $unset: { customDomain: '' } }
  );
  console.log('Unset null customDomain on', result.modifiedCount, 'docs');

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
