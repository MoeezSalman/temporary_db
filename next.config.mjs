/** @type {import('next').NextConfig} */
const nextConfig = {
  // API-only service; no static pages needed beyond health check
  poweredByHeader: false,
  // Allow large image uploads (Render/Vercel body limits still apply at platform level)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
