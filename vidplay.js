// Vidplay & RabbitStream Extractor Plugin
return {
  id: "com.community.vidplay",
  name: "Vidplay & RabbitStream",
  version: "1.1.0",
  author: "Community",
  types: ["movie", "tv"],

  async getStreams({ tmdbId, type, season, episode }) {
    if (!tmdbId) return [];
    const embedUrl = type === 'movie'
      ? `https://vidplay.online/e/${tmdbId}`
      : `https://vidplay.online/e/${tmdbId}/${season || 1}/${episode || 1}`;

    return await Showrush.extractors.vidplay(embedUrl, "Vidplay 1080p");
  }
};
