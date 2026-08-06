import { connectDB } from '@/lib/db';

export async function GET() {
  try {
    await connectDB();
    return Response.json({ status: 'ok', service: 'rua-sadiq-api' });
  } catch (err) {
    return Response.json(
      { status: 'error', message: err.message },
      { status: 503 }
    );
  }
}
