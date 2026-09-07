/**
 * Option B: Assign all legacy catalog items (no siteId) to the Rua Sadiq site.
 *
 * - Does NOT touch products/categories/materials that already have a siteId
 *   (other tenant stores stay isolated).
 * - Creates Site slug "rua-sadiq" if missing.
 * - Optionally links an existing user by email, or creates a store-owner user.
 *
 * Usage (from backend folder, with .env / MONGO_URI set):
 *   node scripts/migrateLegacyToRuaSadiq.js
 *
 * Optional env:
 *   RUA_OWNER_EMAIL=owner@example.com   # link this user as owner (must exist)
 *   RUA_OWNER_PASSWORD=ChangeMe123!     # only used if creating a new user
 *   RUA_OWNER_NAME=Rua Sadiq Owner
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) {
  console.error('Set MONGO_URI in .env');
  process.exit(1);
}

const SLUG = 'rua-sadiq';
const SITE_NAME = 'Rua Sadiq';
const INDUSTRY = 'furniture';

await mongoose.connect(uri);
const db = mongoose.connection.db;

const users = db.collection('users');
const sites = db.collection('sites');
const products = db.collection('products');
const categories = db.collection('categories');
const materials = db.collection('materials');
const brandings = db.collection('brandings');

const legacyFilter = {
  $or: [{ siteId: null }, { siteId: { $exists: false } }],
};

console.log('--- Migrate legacy catalog → Rua Sadiq site ---');

// 1) Find or create Site
let site = await sites.findOne({ slug: SLUG });
if (!site) {
  // Prefer linking an existing user if RUA_OWNER_EMAIL is set
  let ownerId = null;
  const email = (process.env.RUA_OWNER_EMAIL || '').trim().toLowerCase();
  if (email) {
    const owner = await users.findOne({ email });
    if (!owner) {
      console.error(`User with email ${email} not found. Create the user first, or omit RUA_OWNER_EMAIL.`);
      process.exit(1);
    }
    ownerId = owner._id;
    console.log('Using existing user as owner:', email);
  } else {
    // Create a dedicated store-owner user
    const ownerEmail = 'rua-sadiq@local.store';
    let owner = await users.findOne({ email: ownerEmail });
    if (!owner) {
      const password = process.env.RUA_OWNER_PASSWORD || 'ChangeMe123!';
      const passwordHash = await bcrypt.hash(password, 10);
      const name = process.env.RUA_OWNER_NAME || 'Rua Sadiq';
      const inserted = await users.insertOne({
        name,
        email: ownerEmail,
        passwordHash,
        role: 'user',
        moduleAccess: { material: true, product: true, categories: true },
        isActive: true,
        siteId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      ownerId = inserted.insertedId;
      console.log(`Created store-owner user: ${ownerEmail} / password: ${password}`);
    } else {
      ownerId = owner._id;
      console.log('Using existing local owner user:', ownerEmail);
    }
  }

  const insert = await sites.insertOne({
    ownerId,
    name: SITE_NAME,
    slug: SLUG,
    industryType: INDUSTRY,
    isActive: true,
    branding: {
      brandName: SITE_NAME,
      logoUrl: null,
      primaryColor: '#f59e0b',
      secondaryColor: '#0f172a',
      accentColor: '#fbbf24',
      backgroundColor: '#020617',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  site = await sites.findOne({ _id: insert.insertedId });
  console.log('Created Site:', SITE_NAME, 'slug=', SLUG, 'id=', String(site._id));

  // Link user → site
  await users.updateOne({ _id: ownerId }, { $set: { siteId: site._id, updatedAt: new Date() } });
  console.log('Linked owner user.siteId → site');

  // Keep legacy Branding.publicSlug in sync for old theme links
  try {
    const existingBranding = await brandings.findOne({ userId: ownerId });
    if (existingBranding) {
      await brandings.updateOne(
        { _id: existingBranding._id },
        { $set: { publicSlug: SLUG, brandName: SITE_NAME, updatedAt: new Date() } }
      );
    } else {
      await brandings.insertOne({
        userId: ownerId,
        publicSlug: SLUG,
        brandName: SITE_NAME,
        logoUrl: null,
        primaryColor: '#f59e0b',
        secondaryColor: '#0f172a',
        accentColor: '#fbbf24',
        backgroundColor: '#020617',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (e) {
    console.warn('Branding sync (non-fatal):', e.message);
  }
} else {
  console.log('Site already exists:', SITE_NAME, 'id=', String(site._id));
  // Ensure owner still has siteId
  if (site.ownerId) {
    await users.updateOne(
      { _id: site.ownerId },
      { $set: { siteId: site._id, updatedAt: new Date() } }
    );
  }
}

const siteId = site._id;

// 2) Migrate ONLY legacy rows (no siteId) — never overwrite other stores
const prodResult = await products.updateMany(legacyFilter, {
  $set: { siteId, updatedAt: new Date() },
});
const catResult = await categories.updateMany(legacyFilter, {
  $set: { siteId, updatedAt: new Date() },
});
const matResult = await materials.updateMany(legacyFilter, {
  $set: { siteId, updatedAt: new Date() },
});

console.log('Migrated products:', prodResult.modifiedCount);
console.log('Migrated categories:', catResult.modifiedCount);
console.log('Migrated materials:', matResult.modifiedCount);

// 3) Sanity counts
const tenantOthers = await products.countDocuments({
  siteId: { $exists: true, $ne: null, $ne: siteId },
});
const ruaCount = await products.countDocuments({ siteId });
const leftover = await products.countDocuments(legacyFilter);

console.log('--- Summary ---');
console.log('Rua Sadiq products now:', ruaCount);
console.log('Other tenant products (untouched):', tenantOthers);
console.log('Legacy remaining (should be 0):', leftover);
console.log('');
console.log('Public store URL: /t/rua-sadiq');
console.log('API: GET /api/public/rua-sadiq/products');
console.log('Done.');

await mongoose.disconnect();
process.exit(0);
