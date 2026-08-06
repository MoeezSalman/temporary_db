import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import Admin from '@/models/Admin';
import { signToken } from '@/lib/auth';

const HARDCODED_USERNAME = 'admin';
const HARDCODED_PASSWORD = 'RuaSadiq2024!';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const { username, password } = body || {};
  if (!username || !password) {
    return Response.json(
      { message: 'Username and password are required' },
      { status: 400 }
    );
  }

  try {
    // 1) Hardcoded credentials
    if (username === HARDCODED_USERNAME && password === HARDCODED_PASSWORD) {
      const token = signToken({ id: 'hardcoded-admin', username: HARDCODED_USERNAME });
      return Response.json({ token, username: HARDCODED_USERNAME });
    }

    // 2) Env credentials
    const envUser = process.env.ADMIN_USERNAME;
    const envPass = process.env.ADMIN_PASSWORD;
    if (envUser && envPass && username === envUser && password === envPass) {
      const token = signToken({ id: 'env-admin', username: envUser });
      return Response.json({ token, username: envUser });
    }

    // 3) DB admin
    await connectDB();
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return Response.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return Response.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({ id: admin._id, username: admin.username });
    return Response.json({ token, username: admin.username });
  } catch (err) {
    return Response.json(
      { message: 'Login failed', error: err.message },
      { status: 500 }
    );
  }
}
