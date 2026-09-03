// StreamWish HD Extractor Plugin
return {
  id: "com.community.streamwish",
  name: "StreamWish HD Extractor",
  version: "1.0.0",
  author: "Community",
  types: ["movie", "tv"],

  async getStreams({ tmdbId, type, season, episode }) {
    if (!tmdbId) return [];
    const embedUrl = type === 'movie'
      ? `https://streamwish.to/e/${tmdbId}`
      : `https://streamwish.to/e/${tmdbId}_${season || 1}_${episode || 1}`;

    return await Showrush.extractors.streamwish(embedUrl, "StreamWish HD");
  }
};
