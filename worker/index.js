export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/fires') {
      const bbox = url.searchParams.get('bbox');
      const source = url.searchParams.get('source') || 'VIIRS_SNPP_NRT';
      const days = url.searchParams.get('days') || '3';
      if (!bbox) {
        return new Response('missing bbox parameter', { status: 400 });
      }
      const mapKey = env.FIRMS_MAP_KEY;
      if (!mapKey) {
        return new Response('server is not configured with a FIRMS_MAP_KEY secret', { status: 500 });
      }
      const firmsUrl = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/' + mapKey + '/' + source + '/' + bbox + '/' + days;
      try {
        const res = await fetch(firmsUrl);
        const text = await res.text();
        if (!res.ok) {
          return new Response('firms api error: HTTP ' + res.status, { status: 502 });
        }
        if (text.toLowerCase().includes('invalid') && text.toLowerCase().includes('key')) {
          return new Response('the server FIRMS_MAP_KEY is invalid', { status: 502 });
        }
        return new Response(text, {
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'cache-control': 'no-store'
          }
        });
      } catch (e) {
        return new Response('fetch to FIRMS failed: ' + e.message, { status: 502 });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
