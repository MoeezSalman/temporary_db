/**
 * Build CORS headers for API responses.
 * Set FRONTEND_ORIGIN to a comma-separated list of allowed origins in production.
 */
export function corsHeaders(request) {
  const origin = request?.headers?.get?.('origin') || '*';
  const allowed = (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let allowOrigin = '*';
  if (allowed.length > 0) {
    allowOrigin = allowed.includes(origin) ? origin : allowed[0];
  } else if (origin && origin !== 'null') {
    allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function withCors(request, response) {
  const headers = corsHeaders(request);
  const newHeaders = new Headers(response.headers);
  for (const [k, v] of Object.entries(headers)) {
    newHeaders.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export function optionsResponse(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
