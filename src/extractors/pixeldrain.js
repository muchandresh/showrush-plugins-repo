// Pixeldrain Direct Stream Extractor
export function extractPixeldrain(url, serverLabel = 'Pixeldrain Ultra HD') {
  if (!url) return [];
  const match = url.match(/pixeldrain\.com\/(?:u|d)\/([a-zA-Z0-9_-]+)/i);
  if (!match) return [];

  const id = match[1];
  return [
    {
      id: `pd-${id}-${Date.now()}`,
      pluginId: 'com.extractors.pixeldrain',
      pluginName: 'Pixeldrain CDN',
      name: `${serverLabel} (Direct 1080p)`,
      server: serverLabel,
      url: `https://pixeldrain.com/api/file/${id}`,
      quality: '1080p',
      format: 'mp4',
      isM3U8: false,
      headers: { Referer: 'https://pixeldrain.com/' },
    },
  ];
}
