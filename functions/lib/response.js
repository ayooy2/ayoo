export function json(data, extraHeaders = {}, status = 200) {
  if (typeof extraHeaders === 'number') { status = extraHeaders; extraHeaders = {}; }
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}
