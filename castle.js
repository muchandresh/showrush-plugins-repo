/**
 * Showrush Castle Multi-Language Provider (Adapted from Castle Nuvio Extractor)
 * Multi-language (English, Hindi, Dubbed) direct streams with multi-CDN resolution.
 */

return {
  id: "com.community.castle",
  name: "Castle Multi-Language HD",
  version: "2.1.0",
  author: "Showrush Community",
  description: "High-speed multi-language direct streaming provider with Multi-Audio & Subtitles support.",
  types: ["movie", "tv"],

  async getStreams(query) {
    const { tmdbId, imdbId, title, type, season = 1, episode = 1 } = query;
    if (!tmdbId && !imdbId) return [];

    try {
      const isTv = type === 'tv';
      const streams = [];

      // 1. Direct Multi-Language Fast CDN mirrors
      const endpoints = [
        {
          name: 'Castle Primary (1080p Ultra)',
          url: isTv
            ? `https://vidsrcme.ru/api.php?type=tv&tmdb=${tmdbId}&season=${season}&episode=${episode}&stream_urls`
            : `https://vidsrcme.ru/api.php?type=movie&tmdb=${tmdbId}&stream_urls`,
        },
        {
          name: 'Castle Dual-Audio (Multi-Language)',
          url: isTv
            ? `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`
            : `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
        }
      ];

      for (const [idx, ep] of endpoints.entries()) {
        try {
          const res = await Showrush.http.get(ep.url, {
            headers: {
              'Referer': 'https://castle.app/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });

          if (res.ok && res.data) {
            let data = res.data;
            if (typeof data === 'string' && data.includes('{')) {
              try { data = JSON.parse(data); } catch {}
            }

            if (data?.data?.stream_urls) {
              // Direct stream urls present
              const subs = (data.default_subs || []).map((s) => ({
                label: s.label || 'English',
                lang: s.lang || 'en',
                url: s.file || '',
              }));

              streams.push({
                id: `castle-${idx}-${Date.now()}`,
                name: ep.name,
                server: `Castle Server ${idx + 1}`,
                url: data.data.stream_urls,
                quality: '1080p',
                isM3U8: true,
                headers: {
                  'Referer': 'https://castle.app/',
                },
                subtitles: subs,
              });
            }
          }
        } catch {}
      }

      return streams;
    } catch (err) {
      console.warn('[Castle Provider] Error:', err);
      return [];
    }
  },
};
