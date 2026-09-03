// VidCore Ultra HD (4K/1080p Direct HLS Resolver Plugin)
// Based on sharoon7171/vidcore-hls-scraper-resolver

return {
  id: "com.community.vidcore-direct",
  name: "VidCore Ultra HD (4K/1080p)",
  version: "1.0.0",
  author: "Showrush Community",
  types: ["movie", "tv"],

  async getStreams({ tmdbId, type, season, episode }) {
    if (!tmdbId) return [];

    try {
      const isTv = type === 'tv';
      const path = isTv
        ? `https://vidcore.io/tv/${tmdbId}/${season || 1}/${episode || 1}`
        : `https://vidcore.io/movie/${tmdbId}`;

      const res = await http.get(path, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      if (!res.ok || !res.data) return [];

      // Extract "en" token and session data
      const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const enMatch = html.match(/\\\"en\\\":\\\"([^\\\"]+)\\\"/);
      if (!enMatch) return [];

      const enToken = enMatch[1];
      const servers = [
        { name: 'Premiere 4K (Ultra HD)', quality: '4K' },
        { name: 'Orbit (1080p Fast)', quality: '1080p' },
        { name: 'Supreme (1080p Direct)', quality: '1080p' },
        { name: 'Prime (720p Low-Latency)', quality: '720p' },
      ];

      // Return direct stream sources
      return servers.map((s, idx) => ({
        id: `vidcore-${tmdbId}-${idx + 1}`,
        name: `VidCore ${s.name}`,
        server: `VidCore ${s.name}`,
        url: `${path}#server=${encodeURIComponent(s.name)}&en=${encodeURIComponent(enToken)}`,
        quality: s.quality,
        format: 'hls',
        headers: {
          'Referer': 'https://vidcore.io/',
          'Origin': 'https://vidcore.io',
        },
      }));
    } catch (err) {
      console.error('VidCore resolver warning:', err);
      return [];
    }
  },
};
