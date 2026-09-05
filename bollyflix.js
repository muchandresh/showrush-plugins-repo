/**
 * Showrush Bollyflix Provider (Ported from CSX by SaurabhKaperwan)
 * Dual-Audio Bollywood, Hollywood Hindi Dubbed, and South Indian Hindi releases with HubCloud & Pixeldrain streaming.
 */

let cachedBollyDomain = null;
let domainFetchTime = 0;

async function getLiveBollyDomain() {
  const now = Date.now();
  if (cachedBollyDomain && now - domainFetchTime < 1000 * 60 * 60) {
    return cachedBollyDomain;
  }

  try {
    const res = await Showrush.http.get(
      'https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (res.ok && res.data) {
      const urls = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (urls.bollyflix) {
        cachedBollyDomain = urls.bollyflix.replace(/\/+$/, '');
        domainFetchTime = now;
        return cachedBollyDomain;
      }
    }
  } catch (err) {
    console.warn('[Bollyflix] Failed to fetch dynamic domain, using fallback:', err);
  }

  cachedBollyDomain = 'https://bollyflix.af';
  return cachedBollyDomain;
}

function parseBollyflixGrid(doc, defaultBadge = 'BOLLYWOOD') {
  const items = [];
  const articles = Array.from(doc.querySelectorAll('div.post-cards > article, article.post'));

  for (const art of articles) {
    const a = art.querySelector('a');
    const href = a?.getAttribute('href');
    if (!href) continue;

    const img = art.querySelector('img');
    const title =
      a?.getAttribute('title')?.replace(/^Download\s+/i, '') ||
      img?.getAttribute('alt')?.replace(/^Download\s+/i, '') ||
      art.textContent?.trim() ||
      'Movie';
    const poster =
      img?.getAttribute('src') ||
      img?.getAttribute('data-src') ||
      img?.getAttribute('data-lazy-src') ||
      '';

    let badge = defaultBadge;
    if (title.toLowerCase().includes('season') || title.toLowerCase().includes('series')) {
      const sMatch = title.match(/season\s*(\d+)/i);
      badge = sMatch ? `S${sMatch[1]}` : 'SERIES';
    } else if (title.includes('4K') || title.includes('2160p')) {
      badge = '4K HDR';
    } else if (title.includes('1080p')) {
      badge = '1080p';
    }

    items.push({
      id: href,
      title: title.split(/\[|\(|480p|720p|1080p|2160p/i)[0].trim(),
      poster: poster.startsWith('//') ? `https:${poster}` : poster,
      type: badge.includes('S') || badge === 'SERIES' ? 'tv' : 'movie',
      qualityBadge: badge,
      sourceUrl: href,
    });
  }

  return items;
}

return {
  id: 'com.community.bollyflix',
  name: 'Bollyflix (Bollywood & OTT)',
  version: '2.0.0',
  author: 'Showrush Community (ported from CSX by SaurabhKaperwan)',
  description: 'Bollywood, Hollywood Hindi Dubbed, and South Indian Hindi releases with direct HubCloud & Pixeldrain streaming.',
  types: ['movie', 'tv', 'anime'],

  // 🌟 Source Offered Catalog: Live Feeds
  async getCatalogFeeds(page = 1) {
    const domain = await getLiveBollyDomain();

    try {
      const [homeRes, bollyRes, hollyRes, animeRes] = await Promise.allSettled([
        Showrush.http.get(page === 1 ? `${domain}` : `${domain}/page/${page}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
        Showrush.http.get(`${domain}/movies/bollywood/page/${page}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
        Showrush.http.get(`${domain}/movies/hollywood/page/${page}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
        Showrush.http.get(`${domain}/anime/page/${page}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
      ]);

      const feeds = [];

      if (homeRes.status === 'fulfilled' && homeRes.value.ok && homeRes.value.data) {
        const doc = Showrush.dom.parse(homeRes.value.data);
        const items = parseBollyflixGrid(doc, 'NEW');
        if (items.length > 0) {
          feeds.push({
            id: 'bf-latest',
            title: '🔥 Bollyflix Latest Cinema',
            items: items.slice(0, 18),
          });
        }
      }

      if (bollyRes.status === 'fulfilled' && bollyRes.value.ok && bollyRes.value.data) {
        const doc = Showrush.dom.parse(bollyRes.value.data);
        const items = parseBollyflixGrid(doc, 'BOLLYWOOD');
        if (items.length > 0) {
          feeds.push({
            id: 'bf-bollywood',
            title: '🇮🇳 Bollywood Movies (Hindi ORG)',
            items: items.slice(0, 18),
          });
        }
      }

      if (hollyRes.status === 'fulfilled' && hollyRes.value.ok && hollyRes.value.data) {
        const doc = Showrush.dom.parse(hollyRes.value.data);
        const items = parseBollyflixGrid(doc, 'HINDI DUB');
        if (items.length > 0) {
          feeds.push({
            id: 'bf-hollywood',
            title: '🌍 Hollywood Movies (Hindi Dubbed)',
            items: items.slice(0, 18),
          });
        }
      }

      if (animeRes.status === 'fulfilled' && animeRes.value.ok && animeRes.value.data) {
        const doc = Showrush.dom.parse(animeRes.value.data);
        const items = parseBollyflixGrid(doc, 'ANIME');
        if (items.length > 0) {
          feeds.push({
            id: 'bf-anime',
            title: '⛩️ Anime Series (Hindi Dubbed)',
            items: items.slice(0, 18),
          });
        }
      }

      return feeds;
    } catch (err) {
      console.warn('[Bollyflix getCatalogFeeds] Notice:', err);
      return [];
    }
  },

  async search(query) {
    if (!query) return [];
    const domain = await getLiveBollyDomain();
    const cleanQuery = query
      .replace(/\b(480p|720p|1080p|2160p|4k|hdr|web-dl|dual audio|hindi|season \d+|s\d+|ep \d+|part \d+)\b/gi, '')
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .trim();

    try {
      const searchRes = await Showrush.http.get(
        `${domain}/search/${encodeURIComponent(cleanQuery || query)}/page/1/`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );

      if (searchRes.ok && searchRes.data) {
        const doc = Showrush.dom.parse(searchRes.data);
        return parseBollyflixGrid(doc);
      }
    } catch {}

    return [];
  },

  async getStreams(query) {
    const { tmdbId, imdbId, title, type = 'movie', season = 1, episode = 1, sourceUrl } = query;

    // Only resolve for Indian/Bollywood content or when explicitly requested
    if (!query.isIndian && query.preferredPluginId !== 'com.community.bollyflix' && !sourceUrl?.includes('bollyflix')) {
      return [];
    }

    // 1. Direct sourceUrl resolution ONLY if it belongs to Bollyflix
    if (sourceUrl && (sourceUrl.includes('bollyflix') || (!sourceUrl.includes('moviesdrive') && !sourceUrl.includes('vegamovies') && query.preferredPluginId === 'com.community.bollyflix'))) {
      try {
        const streams = await this.getSourceStreams(sourceUrl, String(episode));
        if (streams.length > 0) return streams;
      } catch {}
    }

    // 2. Search Bollyflix catalog
    if (title) {
      try {
        const searchResults = await this.search(title);
        if (searchResults.length > 0) {
          const target = searchResults[0];
          const streams = await this.getSourceStreams(target.sourceUrl || target.id, String(episode));
          if (streams.length > 0) return streams;
        }
      } catch (err) {
        console.warn('[Bollyflix getStreams] Search notice:', err);
      }
    }

    return [];
  },

  async getSourceStreams(sourceId, episode = '1') {
    try {
      const res = await Showrush.http.get(sourceId, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!res.ok || !res.data) return [];

      const html = typeof res.data === 'string' ? res.data : '';
      const streams = [];

      // 1. Gather all download buttons / links
      const btnMatches = Array.from(
        html.matchAll(/href=["'](https?:\/\/[^"']*(?:hubcloud|vcloud|fastdl|sidexfee|download|file)[^"']*)["']/gi)
      ).map((m) => m[1].replace(/&amp;/g, '&'));

      const uniqueLinks = Array.from(new Set(btnMatches)).filter(
        (l) => !l.includes('apk') && !l.includes('telegram') && !l.includes('comment')
      );

      for (const rawLink of uniqueLinks.slice(0, 4)) {
        try {
          let resolved = rawLink;

          // Check if sidexfee / bypass is needed
          if (!resolved.includes('fastdl') && resolved.includes('?id=')) {
            const sid = resolved.split('id=').pop()?.split('&')[0];
            if (sid) {
              const bRes = await Showrush.http.get(`https://web.sidexfee.com/?id=${sid}`);
              if (bRes.ok && bRes.data) {
                const bStr = typeof bRes.data === 'string' ? bRes.data : JSON.stringify(bRes.data);
                const lm = bStr.match(/link":"([^"]+)"/);
                if (lm) {
                  resolved = atob(lm[1].replace(/\\\//g, '/'));
                }
              }
            }
          }

          if (Showrush.extractors && typeof Showrush.extractors.hubcloud === 'function') {
            const extracted = await Showrush.extractors.hubcloud(resolved, sourceId);
            if (extracted && extracted.length > 0) {
              for (const [idx, s] of extracted.entries()) {
                streams.push({
                  ...s,
                  id: `bf-${idx}-${Date.now()}`,
                  name: `Bollyflix • ${s.server || 'Direct'}`,
                  server: `Bollyflix (${s.server || 'Direct'})`,
                  pluginId: 'com.community.bollyflix',
                  pluginName: 'Bollyflix (Bollywood & OTT)',
                });
              }
              if (streams.length >= 3) break;
            }
          }
        } catch {}
      }

      return streams;
    } catch (err) {
      console.warn('[Bollyflix getSourceStreams] Notice:', err);
      return [];
    }
  },
};
