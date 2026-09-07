// Streamtape Direct MP4 Extractor
export async function extractStreamtape(http, embedUrl, serverLabel = 'Streamtape HD') {
  if (!embedUrl) return [];
  try {
    const res = await http.get(embedUrl, {
      headers: { Referer: 'https://streamtape.com/', 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok || typeof res.data !== 'string') return [];
    const html = res.data;

    const m = html.match(/document\.getElementById\('robotlink'\)\.innerHTML\s*=\s*'(.*?)'\s*\+\s*'(.*?)'/);
    if (m) {
      let finalUrl = `https:${m[1]}${m[2]}`;
      finalUrl = finalUrl.replace(/&token=.*?$/, '');
      return [
        {
          id: `streamtape-${Date.now()}`,
          pluginId: 'com.extractors.streamtape',
          pluginName: 'Streamtape Direct',
          name: `${serverLabel} (MP4 Direct)`,
          server: serverLabel,
          url: finalUrl,
          quality: '1080p',
          format: 'mp4',
          isM3U8: false,
          headers: { Referer: 'https://streamtape.com/' },
        },
      ];
    }
  } catch (err) {
    console.warn('[extractStreamtape] Error:', err);
  }
  return [];
}
