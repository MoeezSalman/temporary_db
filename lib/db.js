import mongoose from 'mongoose';

const globalForMongoose = globalThis;

let cached = globalForMongoose._mongoose;
if (!cached) {
  cached = globalForMongoose._mongoose = { conn: null, promise: null, bucket: null };
}

export async function connectDB() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGO_URI (or MONGODB_URI) is not set');
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri).then((m) => {
      cached.bucket = new mongoose.mongo.GridFSBucket(m.connection.db, {
        bucketName: 'uploads',
      });
      console.log('✅ MongoDB connected:', m.connection.host);
      return m;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export function getBucket() {
  if (!cached.bucket) {
    throw new Error('GridFS bucket not initialized — call connectDB() first');
  }
  return cached.bucket;
}
