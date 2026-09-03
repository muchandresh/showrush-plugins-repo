/**
 * Showrush MoviesDrive Provider (Adapted from Nuvio Scraper)
 * Multi-quality direct CDN stream extractor for Movies and TV Series.
 */

return {
  id: "com.community.moviesdrive",
  name: "MoviesDrive Multi-CDN",
  version: "1.1.0",
  author: "Community",
  description: "Multi-quality direct streaming provider with HubCloud & FastCDN links.",
  types: ["movie", "tv"],

  async resolveStreams(query) {
    const { title, type, season = 1, episode = 1 } = query;
    if (!title) return [];

    try {
      const MAIN_URL = "https://new1.moviesdrive.surf";
      const HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer": `${MAIN_URL}/`,
      };

      // 1. Search title on MoviesDrive
      const searchUrl = `${MAIN_URL}/?s=${encodeURIComponent(title)}`;
      const res = await Showrush.http.get(searchUrl, { headers: HEADERS });
      if (!res.ok || !res.data) return [];

      const postMatches = Showrush.dom.extractAllRegex(res.data, /<h2 class="entry-title"><a href="([^"]+)">([^<]+)<\/a>/);
      if (!postMatches || postMatches.length === 0) return [];

      // Pick first matching post URL
      const postUrl = postMatches[0][1];
      const postRes = await Showrush.http.get(postUrl, { headers: HEADERS });
      if (!postRes.ok || !postRes.data) return [];

      // Extract download & stream mirrors
      const linkMatches = Showrush.dom.extractAllRegex(postRes.data, /href="([^"]+(?:hubcloud|pixeldrain|fastcdn|streamtape)[^"]*)"/);
      const streams = [];

      for (const [idx, match] of linkMatches.slice(0, 3).entries()) {
        const mirrorUrl = match[1];
        streams.push({
          id: `md-${idx}-${Date.now()}`,
          name: `MoviesDrive Mirror ${idx + 1} (${mirrorUrl.includes('1080') ? '1080p' : 'HD'})`,
          url: mirrorUrl,
          quality: '1080p',
          isM3U8: mirrorUrl.includes('.m3u8'),
          headers: HEADERS,
        });
      }

      return streams;
    } catch (err) {
      console.warn('[MoviesDrive Provider] Error:', err);
      return [];
    }
  }
};
