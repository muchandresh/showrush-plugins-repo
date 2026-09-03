/**
 * VidnestAnime Scraper for Showrush (Adapted from yoruix/nuvio-providers)
 * Extracts anime streaming links with TMDb -> AniList mapping and multiple server redundancy.
 */

return {
  id: "com.community.vidnest-anime",
  name: "Vidnest Anime Multi-Server",
  version: "1.2.0",
  author: "Community",
  description: "Vidnest Anime streaming with AniList mapping and Satoru, Pahe, Anya, and Miko servers.",
  types: ["tv", "movie", "anime"],

  async getStreams({ tmdbId, title, type, season = 1, episode = 1 }) {
    if (!title && !tmdbId) return [];

    try {
      const VIDNEST_BASE = "https://backend.vidnest.fun";
      const WORKING_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
        "Referer": "https://vidnest.fun/",
        "Origin": "https://vidnest.fun",
        "Accept": "application/json, text/plain, */*",
      };

      // 1. Get Anime mapping (AniList ID + Romaji Title)
      let anilistId = tmdbId >= 1000000 ? tmdbId - 1000000 : null;
      let epNum = episode;

      if (!anilistId && Showrush.anime) {
        try {
          const mapping = await Showrush.anime.getMapping(title, type, season, episode);
          if (mapping && mapping.anilistId) anilistId = mapping.anilistId;
          if (mapping && mapping.absoluteEpisode) epNum = mapping.absoluteEpisode;
        } catch {}
      }

      if (!anilistId) anilistId = tmdbId;

      const servers = [
        { name: 'Vidnest Satoru (1080p)', url: `${VIDNEST_BASE}/satoru/${anilistId}/${epNum}` },
        { name: 'Vidnest Pahe (Fast HLS)', url: `${VIDNEST_BASE}/aniwave/${anilistId}/${epNum}/sub/pahe` },
        { name: 'Vidnest Anya (Multi-Quality)', url: `${VIDNEST_BASE}/aniwave/${anilistId}/${epNum}/sub/anya` },
      ];

      const streams = [];

      for (const [idx, srv] of servers.entries()) {
        try {
          const res = await Showrush.http.get(srv.url, { headers: WORKING_HEADERS });
          if (res.ok && res.data) {
            let json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            const streamUrl = json?.url || json?.stream || json?.data?.url;

            if (streamUrl) {
              streams.push({
                id: `vidnest-${idx}-${Date.now()}`,
                name: srv.name,
                server: `Vidnest Server ${idx + 1}`,
                url: streamUrl,
                quality: '1080p',
                isM3U8: streamUrl.includes('.m3u8'),
                headers: {
                  'Referer': 'https://vidnest.fun/',
                },
                subtitles: (json.subtitles || json.tracks || []).map((s) => ({
                  label: s.label || 'English',
                  lang: (s.lang || 'en').toLowerCase().slice(0, 2),
                  url: s.file || s.url || '',
                })),
              });
            }
          }
        } catch {}
      }

      return streams;
    } catch (err) {
      console.warn('[Vidnest Anime Provider] Error:', err);
      return [];
    }
  },
};
