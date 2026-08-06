import mongoose from 'mongoose';
import { connectDB, getBucket } from '@/lib/db';

export async function GET(request, { params }) {
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return Response.json({ message: 'Invalid image id' }, { status: 400 });
  }

  try {
    await connectDB();
    const bucket = getBucket();
    const fileId = new mongoose.Types.ObjectId(id);

    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return Response.json({ message: 'Image not found' }, { status: 404 });
    }

    const file = files[0];
    const etag = `"${file._id}-${file.length || 0}"`;

    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304 });
    }

    // Collect stream into buffer for Next Response
    const chunks = [];
    const downloadStream = bucket.openDownloadStream(fileId);

    await new Promise((resolve, reject) => {
      downloadStream.on('data', (chunk) => chunks.push(chunk));
      downloadStream.on('error', reject);
      downloadStream.on('end', resolve);
    });

    const buffer = Buffer.concat(chunks);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': file.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: etag,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    return Response.json(
      { message: 'Error streaming image', error: err.message },
      { status: 500 }
    );
  }
}
