/**
 * Showrush DramaCool & Asian Cinema Provider
 * Direct Asian Drama & Movie Extractor with Native Catalog Feeds & Auto-Failover.
 */

return {
  id: "com.community.dramacool",
  name: "DramaCool (Asian Cinema)",
  version: "1.0.0",
  author: "Showrush Community",
  description: "Native streaming provider for Korean, Japanese & Chinese Dramas with live episode catalog feeds.",
  types: ["tv", "movie"],

  async getStreams(query) {
    const { tmdbId, imdbId, title, type = 'tv', season = 1, episode = 1 } = query;

    // 1. Try DramaCool Asian Cinema Scraper
    if (title) {
      try {
        const searchUrl = `https://asianc.to/search?type=movies&keyword=${encodeURIComponent(title)}`;
        const res = await Showrush.http.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://asianc.to/',
          },
        });

        if (res.ok && res.data) {
          const doc = Showrush.dom.parse(res.data);
          const firstResult = doc.querySelector('.list-episode-item li a');
          const dramaPath = firstResult?.getAttribute('href') || '';

          if (dramaPath) {
            const dramaUrl = dramaPath.startsWith('http') ? dramaPath : `https://asianc.to${dramaPath}`;
            const dramaRes = await Showrush.http.get(dramaUrl);
            if (dramaRes.ok && dramaRes.data) {
              const dramaDoc = Showrush.dom.parse(dramaRes.data);
              const episodeLinks = dramaDoc.querySelectorAll('.list-episode-item-2 li a');
              
              let targetEpUrl = '';
              if (type === 'movie' || episodeLinks.length <= 1) {
                targetEpUrl = episodeLinks[0]?.getAttribute('href') || dramaUrl;
              } else {
                const epMatch = Array.from(episodeLinks).find((el) => {
                  const text = el.textContent || '';
                  return text.includes(`Episode ${episode}`) || text.includes(`EP ${episode}`);
                });
                targetEpUrl = epMatch?.getAttribute('href') || episodeLinks[0]?.getAttribute('href') || '';
              }

              if (targetEpUrl) {
                const fullEpUrl = targetEpUrl.startsWith('http') ? targetEpUrl : `https://asianc.to${targetEpUrl}`;
                const epRes = await Showrush.http.get(fullEpUrl);
                if (epRes.ok && epRes.data) {
                  const epDoc = Showrush.dom.parse(epRes.data);
                  const serverElements = epDoc.querySelectorAll('.anime_muti_link ul li');
                  const streams = [];

                  for (const [idx, sEl] of Array.from(serverElements).slice(0, 3).entries()) {
                    const embed = sEl.getAttribute('data-video');
                    if (!embed) continue;
                    const embedUrl = embed.startsWith('//') ? `https:${embed}` : embed;
                    const serverName = sEl.textContent?.replace('Choose this server', '').trim() || `Server ${idx + 1}`;

                    streams.push({
                      id: `drama-${idx}-${Date.now()}`,
                      name: `DramaCool ${serverName}`,
                      server: serverName,
                      url: embedUrl,
                      quality: '1080p',
                      format: 'hls',
                      isM3U8: embedUrl.includes('.m3u8'),
                      headers: { 'Referer': 'https://asianc.to/' },
                      pluginId: 'com.community.dramacool',
                      pluginName: 'DramaCool (Asian Cinema)',
                    });
                  }

                  if (streams.length > 0) return streams;
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('[DramaCool Scraper] Notice:', err);
      }
    }

    // 2. Resilient fallback to universal extractor
    if (Showrush?.extractors?.vidsrc) {
      try {
        const sources = await Showrush.extractors.vidsrc({
          tmdbId,
          imdbId,
          title,
          type: type === 'movie' ? 'movie' : 'tv',
          season,
          episode,
        });

        if (Array.isArray(sources) && sources.length > 0) {
          return sources.map((s, idx) => ({
            ...s,
            id: `drama-fb-${idx + 1}-${Date.now()}`,
            pluginId: 'com.community.dramacool',
            pluginName: 'DramaCool (Asian Cinema)',
            name: `DramaCool Stream • ${s.server || `CDN ${idx + 1}`}`,
            server: `DramaCool CDN ${idx + 1}`,
          }));
        }
      } catch (err) {
        console.warn('[DramaCool Fallback] Notice:', err);
      }
    }

    return [];
  },

  // 🌟 Source Offered Catalog: DramaCool Live Feeds
  async getCatalogFeeds(page = 1) {
    try {
      const res = await Showrush.http.get(`https://asianc.to/?page=${page}`);
      if (!res.ok || !res.data) return [];

      const doc = Showrush.dom.parse(res.data);
      const feeds = [];

      // 1. Recently Released Episodes
      const recentItems = doc.querySelectorAll('.list-episode-item-2 li');
      if (recentItems.length > 0) {
        feeds.push({
          id: 'recent-dramas',
          title: '⚡ Today\'s Newly Added Episodes',
          items: Array.from(recentItems).map((el) => {
            const a = el.querySelector('a');
            const img = el.querySelector('img');
            const epBadge = el.querySelector('.ep')?.textContent?.trim();
            const title = el.querySelector('.title')?.textContent?.trim() || a?.getAttribute('title') || 'Asian Drama';
            const href = a?.getAttribute('href') || '';
            const poster = img?.getAttribute('data-original') || img?.getAttribute('src') || '';

            return {
              id: href,
              title,
              poster: poster.startsWith('//') ? `https:${poster}` : poster,
              type: 'tv',
              qualityBadge: epBadge || 'HD',
              sourceUrl: href.startsWith('http') ? href : `https://asianc.to${href}`,
            };
          }).filter((item) => Boolean(item.id)),
        });
      }

      // 2. Ongoing & Top Dramas
      const topItems = doc.querySelectorAll('.list-episode-item li');
      if (topItems.length > 0) {
        feeds.push({
          id: 'top-ongoing-dramas',
          title: '🔥 Trending & Ongoing Asian Dramas',
          items: Array.from(topItems).map((el) => {
            const a = el.querySelector('a');
            const img = el.querySelector('img');
            const title = el.querySelector('.title')?.textContent?.trim() || a?.getAttribute('title') || 'Asian Drama';
            const href = a?.getAttribute('href') || '';
            const poster = img?.getAttribute('data-original') || img?.getAttribute('src') || '';

            return {
              id: href,
              title,
              poster: poster.startsWith('//') ? `https:${poster}` : poster,
              type: 'tv',
              qualityBadge: 'K-DRAMA',
              sourceUrl: href.startsWith('http') ? href : `https://asianc.to${href}`,
            };
          }).filter((item) => Boolean(item.id)),
        });
      }

      return feeds;
    } catch (err) {
      console.warn('[DramaCool getCatalogFeeds] Notice:', err);
      return [];
    }
  },

  async getSourceDetails(sourceId) {
    const fullUrl = sourceId.startsWith('http') ? sourceId : `https://asianc.to${sourceId}`;
    try {
      const res = await Showrush.http.get(fullUrl);
      if (!res.ok || !res.data) return null;

      const doc = Showrush.dom.parse(res.data);
      const title = doc.querySelector('h1')?.textContent?.trim() || 'Drama Details';
      const overview = doc.querySelector('.info p')?.textContent?.trim() || '';
      const posterImg = doc.querySelector('.img img');
      const poster = posterImg?.getAttribute('src') || '';
      const episodeLinks = doc.querySelectorAll('.list-episode-item-2 li a');

      return {
        id: sourceId,
        title,
        overview,
        poster: poster.startsWith('//') ? `https:${poster}` : poster,
        type: 'tv',
        episodes: Array.from(episodeLinks).map((a, idx) => ({
          id: a.getAttribute('href') || `${sourceId}-ep-${idx + 1}`,
          episodeNumber: idx + 1,
          title: a.querySelector('.title')?.textContent?.trim() || `Episode ${idx + 1}`,
        })),
      };
    } catch {
      return null;
    }
  },

  async getSourceStreams(sourceId, episodeId) {
    const targetUrl = episodeId || sourceId;
    const fullUrl = targetUrl.startsWith('http') ? targetUrl : `https://asianc.to${targetUrl}`;
    try {
      const res = await Showrush.http.get(fullUrl);
      if (!res.ok || !res.data) return [];

      const doc = Showrush.dom.parse(res.data);
      const serverElements = doc.querySelectorAll('.anime_muti_link ul li');
      const streams = [];

      for (const [idx, sEl] of Array.from(serverElements).entries()) {
        const embed = sEl.getAttribute('data-video');
        if (!embed) continue;
        const embedUrl = embed.startsWith('//') ? `https:${embed}` : embed;
        const serverName = sEl.textContent?.replace('Choose this server', '').trim() || `Server ${idx + 1}`;

        streams.push({
          id: `dramacool-${idx}-${Date.now()}`,
          name: `DramaCool ${serverName}`,
          server: serverName,
          url: embedUrl,
          quality: '1080p',
          format: 'hls',
          isM3U8: embedUrl.includes('.m3u8'),
          headers: { 'Referer': 'https://asianc.to/' },
          pluginId: 'com.community.dramacool',
          pluginName: 'DramaCool (Asian Cinema)',
        });
      }

      return streams;
    } catch {
      return [];
    }
  },
};
