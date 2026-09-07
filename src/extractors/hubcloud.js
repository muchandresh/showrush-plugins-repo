// FastDL / HubCloud / Google CDN Direct Stream Extractor
export async function extractHubcloud(http, url, referer) {
  if (!url) return [];
  const streams = [];

  try {
    const res = await http.get(url, {
      headers: { Referer: referer || url, 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok || typeof res.data !== 'string') return [];
    const html = res.data;

    // 1. FastDL / Google CDN MP4
    const fastdlMatch = html.match(/href=["'](https?:\/\/[^"']*(?:fastdl|dl\.fastdl)[^"']*)["']/i);
    if (fastdlMatch) {
      try {
        const fRes = await http.get(fastdlMatch[1], {
          headers: { Referer: url, 'User-Agent': 'Mozilla/5.0' },
        });
        if (fRes.ok && typeof fRes.data === 'string') {
          const fHtml = fRes.data;
          const reurlMatch =
            fHtml.match(/var\s+reurl\s*=\s*["']([^"']+)["']/i) ||
            fHtml.match(/link=([^"&'\s]+)/i);
          if (reurlMatch) {
            let direct = reurlMatch[1];
            if (direct.includes('link=')) direct = decodeURIComponent(direct.split('link=')[1]);
            streams.push({
              id: `fastdl-google-${Date.now()}`,
              pluginId: 'com.extractors.hubcloud',
              pluginName: 'FastDL / Google CDN',
              name: 'Google FastDL Ultra HD (Direct 1080p)',
              server: 'Google High-Speed CDN',
              url: direct,
              quality: '1080p',
              format: 'mp4',
              isM3U8: false,
              headers: { Referer: 'https://fastdl.zip/' },
            });
          }
        }
      } catch (err) {
        console.warn('[FastDL Extractor] Notice:', err);
      }
    }

    // 2. Cloudflare R2 FSL Direct
    const fslMatch = html.match(/href=["'](https?:\/\/[^"']*(?:fsl|r2\.dev|hubdrive)[^"']*)["']/i);
    if (fslMatch && !streams.some((s) => s.url === fslMatch[1])) {
      streams.push({
        id: `hubcloud-fsl-${Date.now()}`,
        pluginId: 'com.extractors.hubcloud',
        pluginName: 'HubCloud R2',
        name: 'Cloudflare R2 Direct Stream (1080p)',
        server: 'Cloudflare R2 CDN',
        url: fslMatch[1],
        quality: '1080p',
        format: 'mp4',
        isM3U8: false,
        headers: { Referer: url },
      });
    }

    // 3. Pixeldrain embedded link
    const pdMatch = html.match(/https?:\/\/pixeldrain\.com\/(?:u|d)\/([a-zA-Z0-9_-]+)/i);
    if (pdMatch) {
      streams.push({
        id: `hubcloud-pd-${pdMatch[1]}-${Date.now()}`,
        pluginId: 'com.extractors.hubcloud',
        pluginName: 'Pixeldrain Ultra HD',
        name: 'Pixeldrain High-Speed Mirror (1080p)',
        server: 'Pixeldrain CDN',
        url: `https://pixeldrain.com/api/file/${pdMatch[1]}`,
        quality: '1080p',
        format: 'mp4',
        isM3U8: false,
        headers: { Referer: 'https://pixeldrain.com/' },
      });
    }
  } catch (err) {
    console.warn('[extractHubcloud] Error:', err);
  }

  return streams;
}
