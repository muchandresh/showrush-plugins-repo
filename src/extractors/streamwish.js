// StreamWish & FileLions & AllWish Obfuscated HLS Extractor
function unpackJs(packed) {
  try {
    const match = packed.match(/}\s*\('(.*)',\s*(\d+),\s*(\d+),\s*'([^']*)'\.split/);
    if (!match) return packed;
    let [, p, a, c, k] = match;
    a = parseInt(a, 10);
    c = parseInt(c, 10);
    const kArr = k.split('|');
    const e = (val) =>
      (val < a ? '' : e(parseInt(val / a, 10))) +
      ((val = val % a) > 35 ? String.fromCharCode(val + 29) : val.toString(36));
    while (c--) {
      if (kArr[c]) {
        p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), kArr[c]);
      }
    }
    return p;
  } catch {
    return packed;
  }
}

export async function extractStreamwish(http, embedUrl, serverLabel = 'StreamWish HD') {
  if (!embedUrl) return [];
  try {
    const origin = new URL(embedUrl).origin;
    const res = await http.get(embedUrl, {
      headers: {
        Referer: `${origin}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok || typeof res.data !== 'string') return [];
    const html = res.data;
    const unpacked = unpackJs(html);

    const m3u8Match =
      unpacked.match(/sources:\s*\[\s*\{\s*file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
      unpacked.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
      html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);

    if (m3u8Match) {
      return [
        {
          id: `streamwish-${Date.now()}`,
          pluginId: 'com.extractors.streamwish',
          pluginName: 'StreamWish / FileLions',
          name: `${serverLabel} (1080p HLS)`,
          server: serverLabel,
          url: m3u8Match[1],
          quality: '1080p',
          format: 'hls',
          isM3U8: true,
          headers: { Referer: `${origin}/`, Origin: origin },
        },
      ];
    }
  } catch (err) {
    console.warn('[extractStreamwish] Error:', err);
  }
  return [];
}
