/**
 * VixSrc Direct HLS Stream Provider (Adapted from yoruix/nuvio-providers)
 * Direct master playlist resolver using window.masterPlaylist token generation.
 */

return {
  id: "com.community.vixsrc",
  name: "VixSrc Direct HLS",
  version: "1.0.0",
  author: "Community",
  description: "High-speed direct master.m3u8 HLS streams with multi-resolution playback.",
  types: ["movie", "tv"],

  async getStreams(query) {
    const { tmdbId, imdbId, title, type = 'movie', season = 1, episode = 1 } = query;
    if (!tmdbId && !imdbId && !title) return [];

    try {
      if (tmdbId) {
        const BASE_URL = "https://vixsrc.to";
        const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

        const isMovie = type === 'movie';
        const vixsrcUrl = isMovie
          ? `${BASE_URL}/movie/${tmdbId}`
          : `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;

        const res = await Showrush.http.get(vixsrcUrl, {
          headers: {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": `${BASE_URL}/`,
          },
        });

        if (res.ok && res.data) {
          const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
          let masterPlaylistUrl = null;

          if (html.includes("window.masterPlaylist")) {
            const urlMatch = html.match(/url:\s*['"]([^'"]+)['"]/);
            const tokenMatch = html.match(/['"]?token['"]?\s*:\s*['"]([^'"]+)['"]/);
            const expiresMatch = html.match(/['"]?expires['"]?\s*:\s*['"]([^'"]+)['"]/);

            if (urlMatch && tokenMatch && expiresMatch) {
              const baseUrl = urlMatch[1];
              const token = tokenMatch[1];
              const expires = expiresMatch[1];
              const sep = baseUrl.includes("?") ? "&" : "?";
              masterPlaylistUrl = `${baseUrl}${sep}token=${token}&expires=${expires}`;
            }
          }

          if (!masterPlaylistUrl) {
            const fallbackMatch = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/);
            if (fallbackMatch) masterPlaylistUrl = fallbackMatch[1];
          }

          if (masterPlaylistUrl) {
            return [
              {
                id: `vixsrc-${tmdbId}-${Date.now()}`,
                name: "VixSrc Primary (1080p Master HLS)",
                server: "VixSrc Direct",
                url: masterPlaylistUrl,
                quality: "1080p",
                format: "hls",
                isM3U8: true,
                headers: {
                  "User-Agent": USER_AGENT,
                  "Referer": `${BASE_URL}/`,
                  "Origin": BASE_URL,
                },
                pluginId: 'com.community.vixsrc',
                pluginName: 'VixSrc Direct HLS',
              },
            ];
          }
        }
      }
    } catch {}

    return [];
  },
};
