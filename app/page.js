export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 40, maxWidth: 640 }}>
      <h1>Rua Sadiq API</h1>
      <p>Next.js backend is running. Public endpoints:</p>
      <ul>
        <li>
          <code>GET /api/health</code>
        </li>
        <li>
          <code>GET /api/products</code>
        </li>
        <li>
          <code>GET /api/categories</code>
        </li>
        <li>
          <code>GET /api/materials</code>
        </li>
        <li>
          <code>GET /api/site-assets</code>
        </li>
        <li>
          <code>GET /api/images/:id</code>
        </li>
        <li>
          <code>POST /api/admin/login</code>
        </li>
      </ul>
    </main>
  );
}
