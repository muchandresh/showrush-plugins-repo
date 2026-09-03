// Filemoon Cloud Extractor Plugin
return {
  id: "com.community.filemoon",
  name: "Filemoon Cloud",
  version: "1.0.0",
  author: "Community",
  types: ["movie", "tv"],

  async getStreams({ tmdbId, type, season, episode }) {
    if (!tmdbId) return [];
    const embedUrl = type === 'movie'
      ? `https://filemoon.sx/e/${tmdbId}`
      : `https://filemoon.sx/e/${tmdbId}_${season || 1}_${episode || 1}`;

    return await Showrush.extractors.filemoon(embedUrl, "Filemoon Cloud");
  }
};
