/**
 * Showrush AllWish Anime & Stream Provider (Adapted from Nuvio Scraper Architecture)
 * Supports Movies, TV Shows, and Anime with Sub/Dub streams and WebVTT subtitles.
 */

return {
  id: "com.community.allwish",
  name: "AllWish Anime & Stream",
  version: "1.2.0",
  author: "Community",
  description: "High-speed multi-quality Sub/Dub anime and media stream extractor with MegaPlay CDN.",
  types: ["movie", "tv", "anime"],

  async resolveStreams(query) {
    const { tmdbId, title, type, season = 1, episode = 1 } = query;
    if (!title && !tmdbId) return [];

    try {
      const BASE_URL = "https://all-wish.me";
      const XML_HEADER = {
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": `${BASE_URL}/`,
      };

      // 1. Get title aliases using Showrush Anime helper
      let searchTitles = [title];
      if (Showrush.anime) {
        try {
          const mapping = await Showrush.anime.getMapping(title, type, season, episode);
          if (mapping && mapping.titles && mapping.titles.length > 0) {
            searchTitles = mapping.titles;
          }
        } catch (err) {
          // ignore mapping error
        }
      }

      // 2. Search AllWish
      let searchHtml = '';
      for (const t of searchTitles) {
        if (!t) continue;
        const searchUrl = `${BASE_URL}/ajax/anime/search?keyword=${encodeURIComponent(t)}`;
        const res = await Showrush.http.get(searchUrl, { headers: XML_HEADER });
        if (res.ok && res.data && typeof res.data === 'string' && res.data.includes('film-detail')) {
          searchHtml = res.data;
          break;
        }
      }

      if (!searchHtml) return [];

      const doc = Showrush.dom.extractAllRegex(searchHtml, /href="\/watch\/([^"?]+)/);
      if (!doc || doc.length === 0) return [];

      const targetPath = doc[0][1];
      const watchUrl = `${BASE_URL}/watch/${targetPath}`;
      const watchRes = await Showrush.http.get(watchUrl, { headers: XML_HEADER });
      if (!watchRes.ok || !watchRes.data) return [];

      // Extract episode IDs
      const epMatches = Showrush.dom.extractAllRegex(watchRes.data, /data-id="([0-9]+)"[^>]*data-number="([0-9]+)"/);
      let targetEpId = null;
      if (epMatches.length > 0) {
        const found = epMatches.find(m => Number(m[2]) === Number(episode));
        targetEpId = found ? found[1] : epMatches[0][1];
      }

      if (!targetEpId) return [];

      // Fetch server list for episode
      const serversUrl = `${BASE_URL}/ajax/episode/servers?episodeId=${targetEpId}`;
      const serverRes = await Showrush.http.get(serversUrl, { headers: XML_HEADER });
      if (!serverRes.ok || !serverRes.data) return [];

      const serverItems = Showrush.dom.extractAllRegex(serverRes.data, /data-id="([0-9]+)"[^>]*data-server-id="([0-9]+)"/);
      const streams = [];

      for (const [idx, sMatch] of serverItems.slice(0, 3).entries()) {
        const sourceUrl = `${BASE_URL}/ajax/episode/sources?id=${sMatch[1]}`;
        const sourceRes = await Showrush.http.get(sourceUrl, { headers: XML_HEADER });
        if (!sourceRes.ok || !sourceRes.data) continue;

        let parsed = sourceRes.data;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch { continue; }
        }

        const realUrl = parsed?.result?.url || parsed?.link;
        if (realUrl) {
          streams.push({
            id: `allwish-${idx}-${Date.now()}`,
            name: `AllWish Server ${idx + 1} (${realUrl.includes('.m3u8') ? 'HLS' : 'CDN'})`,
            url: realUrl,
            quality: '1080p',
            isM3U8: realUrl.includes('.m3u8'),
            headers: {
              "Referer": `${BASE_URL}/`,
              "Origin": BASE_URL,
            },
            subtitles: (parsed?.tracks || [])
              .filter(t => t.kind === 'captions' || t.kind === 'subtitles')
              .map(t => ({
                url: t.file,
                lang: t.label ? t.label.toLowerCase().slice(0, 2) : 'en',
                label: t.label || 'English [CC]'
              }))
          });
        }
      }

      return streams;
    } catch (err) {
      console.warn('[AllWish Provider] Error:', err);
      return [];
    }
  }
};
