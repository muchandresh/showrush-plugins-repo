// Streamtape MP4 Direct Extractor Plugin
return {
  id: "com.community.streamtape",
  name: "Streamtape MP4 Direct",
  version: "1.0.0",
  author: "Community",
  types: ["movie"],

  async getStreams({ tmdbId }) {
    if (!tmdbId) return [];
    const embedUrl = `https://streamtape.com/e/${tmdbId}`;
    return await Showrush.extractors.streamtape(embedUrl);
  }
};
