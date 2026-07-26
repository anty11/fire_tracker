export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/fires') {
      const bbox = url.searchParams.get('bbox');
      const days = url.searchParams.get('days') || '3';

      if (!bbox) {
        return new Response('missing bbox parameter', { status: 400 });
      }

      const mapKey = env.FIRMS_MAP_KEY;
      if (!mapKey) {
        return new Response('server is not configured with a FIRMS_MAP_KEY secret', { status: 500 });
      }

      const sources = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'];

      const results = await Promise.all(sources.map(async (source) => {
        const firmsUrl = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/' + mapKey + '/' + source + '/' + bbox + '/' + days;
        try {
          const res = await fetch(firmsUrl);
          const text = await res.text();
          if (!res.ok) return { source, ok: false, error: 'HTTP ' + res.status };
          if (text.toLowerCase().includes('invalid') && text.toLowerCase().includes('key')) {
            return { source, ok: false, error: 'invalid_key' };
          }
          return { source, ok: true, text };
        } catch (e) {
          return { source, ok: false, error: e.message };
        }
      }));

      const succeeded = results.filter(r => r.ok);
      if (!succeeded.length) {
        const errs = results.map(r => r.source + ': ' + r.error).join(' | ');
        return new Response('all sources failed: ' + errs, { status: 502 });
      }

      let header = null;
      const rows = [];
      const seen = new Set();

      for (const r of succeeded) {
        const lines = r.text.trim().split('\n');
        if (lines.length < 1) continue;
        if (!header) header = lines[0];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          const cells = line.split(',');
          const dedupeKey = cells.slice(0, 2).join(',') + '|' + (cells[5] || '') + '|' + (cells[6] || '');
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          rows.push(line);
        }
      }

      const combined = (header ? header + '\n' : '') + rows.join('\n');
      return new Response(combined, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
