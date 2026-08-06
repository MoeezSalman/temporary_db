import { Readable } from 'stream';
import mongoose from 'mongoose';
import { getBucket } from './db';

/**
 * Save a File (from FormData) or a buffer-like object into GridFS.
 * Returns the new ObjectId as a string.
 */
export async function saveFileToGridFS(file) {
  const bucket = getBucket();

  let buffer;
  let filename;
  let contentType;

  if (file && typeof file.arrayBuffer === 'function') {
    // Web File / Blob from request.formData()
    buffer = Buffer.from(await file.arrayBuffer());
    filename = file.name || 'upload.bin';
    contentType = file.type || 'application/octet-stream';
  } else if (file?.buffer) {
    buffer = file.buffer;
    filename = file.originalname || file.name || 'upload.bin';
    contentType = file.mimetype || file.type || 'application/octet-stream';
  } else {
    throw new Error('Invalid file payload for GridFS');
  }

  return new Promise((resolve, reject) => {
    const readable = Readable.from(buffer);
    const uploadStream = bucket.openUploadStream(filename, { contentType });
    readable
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve(uploadStream.id.toString()));
  });
}

export async function saveFilesToGridFS(files = []) {
  const ids = [];
  for (const file of files) {
    ids.push(await saveFileToGridFS(file));
  }
  return ids;
}

export async function deleteFileFromGridFS(id) {
  try {
    const bucket = getBucket();
    await bucket.delete(new mongoose.Types.ObjectId(String(id)));
  } catch (err) {
    console.warn('Could not delete GridFS file', id, err.message);
  }
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export function assertImageFile(file) {
  if (!file) return;
  const type = file.type || file.mimetype || '';
  if (!ALLOWED_MIME.has(type)) {
    throw new Error('Only image files (jpg, png, webp, gif) are allowed');
  }
  // size is available on File objects
  if (typeof file.size === 'number' && file.size > MAX_BYTES) {
    throw new Error('File exceeds 8MB limit');
  }
}
