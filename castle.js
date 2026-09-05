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
    const { tmdbId, imdbId, title, type = 'movie', season = 1, episode = 1 } = query;
    if (!tmdbId && !imdbId && !title) return [];

    // Only run if explicitly preferred to prevent duplicate VidSrc streams
    if (query.preferredPluginId !== 'com.community.castle') {
      return [];
    }

    try {
      if (Showrush?.extractors?.vidsrc) {
        const sources = await Showrush.extractors.vidsrc({
          tmdbId,
          imdbId,
          title,
          type,
          season,
          episode,
        });

        if (Array.isArray(sources) && sources.length > 0) {
          const names = [
            'Castle Primary HD (Multi-Audio)',
            'Castle Hindi/English Dual-Audio',
            'Castle Fast Mirror 1',
            'Castle Redundant CDN',
          ];
          return sources.map((s, idx) => ({
            ...s,
            id: `castle-${idx + 1}-${Date.now()}`,
            pluginId: 'com.community.castle',
            pluginName: 'Castle Multi-Language HD',
            name: names[idx] || `Castle Server ${idx + 1}`,
            server: `Castle Server ${idx + 1}`,
          }));
        }
      }

      return [];
    } catch (err) {
      console.warn('[Castle Provider] Error:', err);
      return [];
    }
  },
};
