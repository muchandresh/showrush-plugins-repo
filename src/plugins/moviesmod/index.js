/**
 * Showrush Moviesmod Provider (Ported from CSX by SaurabhKaperwan)
 * Dual-Audio Hollywood, Bollywood & Ongoing Web Series with HubCloud & FastDL streaming.
 */

let cachedMoviesmodDomain = null;
let domainFetchTime = 0;

async function getLiveMoviesmodDomain() {
  if (typeof Showrush !== 'undefined' && Showrush.settings && Showrush.settings.customBaseUrl) {
    return Showrush.settings.customBaseUrl.replace(/\/+$/, '');
  }
  if (this && this.settings && this.settings.customBaseUrl) {
    return this.settings.customBaseUrl.replace(/\/+$/, '');
  }

  const now = Date.now();
  if (cachedMoviesmodDomain && now - domainFetchTime < 1000 * 60 * 60) {
    return cachedMoviesmodDomain;
  }

  try {
    const res = await Showrush.http.get(
      'https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (res.ok && res.data) {
      const urls = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (urls.moviesmod) {
        cachedMoviesmodDomain = urls.moviesmod.replace(/\/+$/, '');
        domainFetchTime = now;
        return cachedMoviesmodDomain;
      }
    }
  } catch (err) {
    console.warn('[Moviesmod] Dynamic domain fetch notice:', err);
  }

  cachedMoviesmodDomain = 'https://moviesmod.zone';
  return cachedMoviesmodDomain;
}

function parseMoviesmodGrid(doc, defaultBadge = 'HD') {
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
  id: 'com.community.moviesmod',
  name: 'Moviesmod (Hollywood & Dual Audio)',
  version: '2.0.0',
  author: 'Showrush Community (ported from CSX by SaurabhKaperwan)',
  description: 'Dual Audio Hollywood movies, Bollywood releases, and Web Series with HubCloud and FastDL direct streaming.',
  types: ['movie', 'tv'],
  languages: ['en', 'hi'],

  async getCatalogFeeds(page = 1) {
    const domain = await getLiveMoviesmodDomain();

    try {
      const [homeRes, seriesRes, moviesRes, animeRes] = await Promise.allSettled([
        Showrush.http.get(page === 1 ? `${domain}/` : `${domain}/page/${page}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
        Showrush.http.get(`${domain}/web-series/on-going/page/${page}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
        Showrush.http.get(`${domain}/movies/page/${page}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
        Showrush.http.get(`${domain}/animated-web-series/page/${page}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
      ]);

      const feeds = [];

      if (homeRes.status === 'fulfilled' && homeRes.value.ok && homeRes.value.data) {
        const doc = Showrush.dom.parse(homeRes.value.data);
        const items = parseMoviesmodGrid(doc, 'FEATURED');
        if (items.length > 0) {
          feeds.push({
            id: 'mm-latest',
            title: '🔥 Moviesmod Trending Releases',
            items: items.slice(0, 18),
          });
        }
      }

      if (seriesRes.status === 'fulfilled' && seriesRes.value.ok && seriesRes.value.data) {
        const doc = Showrush.dom.parse(seriesRes.value.data);
        const items = parseMoviesmodGrid(doc, 'SERIES');
        if (items.length > 0) {
          feeds.push({
            id: 'mm-series',
            title: '📺 Ongoing Web Series',
            items: items.slice(0, 18),
          });
        }
      }

      if (moviesRes.status === 'fulfilled' && moviesRes.value.ok && moviesRes.value.data) {
        const doc = Showrush.dom.parse(moviesRes.value.data);
        const items = parseMoviesmodGrid(doc, '1080p');
        if (items.length > 0) {
          feeds.push({
            id: 'mm-movies',
            title: '🎬 Hollywood & Dual Audio Movies',
            items: items.slice(0, 18),
          });
        }
      }

      return feeds;
    } catch (err) {
      console.warn('[Moviesmod getCatalogFeeds] Notice:', err);
      return [];
    }
  },

  async search(query) {
    if (!query) return [];
    const domain = await getLiveMoviesmodDomain();
    const cleanQuery = query
      .replace(/\b(480p|720p|1080p|2160p|4k|hdr|web-dl|dual audio|hindi|season \d+|s\d+|ep \d+|part \d+)\b/gi, '')
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .trim();

    try {
      const searchRes = await Showrush.http.get(
        `${domain}/search/${encodeURIComponent(cleanQuery || query)}/page/1`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );

      if (searchRes.ok && searchRes.data) {
        const doc = Showrush.dom.parse(searchRes.data);
        return parseMoviesmodGrid(doc);
      }
    } catch {}

    return [];
  },

  async getStreams(query) {
    const { tmdbId, imdbId, title, type = 'movie', season = 1, episode = 1, sourceUrl } = query;

    if (sourceUrl && (sourceUrl.includes('moviesmod') || query.preferredPluginId === 'com.community.moviesmod')) {
      try {
        const streams = await this.getSourceStreams(sourceUrl, String(episode));
        if (streams.length > 0) return streams;
      } catch {}
    }

    if (title) {
      try {
        const searchResults = await this.search(title);
        if (searchResults.length > 0) {
          const target = searchResults[0];
          const streams = await this.getSourceStreams(target.sourceUrl || target.id, String(episode));
          if (streams.length > 0) return streams;
        }
      } catch (err) {
        console.warn('[Moviesmod getStreams] Search notice:', err);
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

      const btnMatches = Array.from(
        html.matchAll(/href=["'](https?:\/\/[^"']*(?:hubcloud|vcloud|fastdl|sidexfee|download|file)[^"']*)["']/gi)
      ).map((m) => m[1].replace(/&amp;/g, '&'));

      const uniqueLinks = Array.from(new Set(btnMatches)).filter(
        (l) => !l.includes('apk') && !l.includes('telegram') && !l.includes('comment')
      );

      for (const rawLink of uniqueLinks.slice(0, 4)) {
        try {
          if (Showrush.extractors && typeof Showrush.extractors.hubcloud === 'function') {
            const extracted = await Showrush.extractors.hubcloud(rawLink, sourceId);
            if (extracted && extracted.length > 0) {
              for (const [idx, s] of extracted.entries()) {
                streams.push({
                  ...s,
                  id: `mm-${idx}-${Date.now()}`,
                  name: `Moviesmod • ${s.server || 'Direct'}`,
                  server: `Moviesmod (${s.server || 'Direct'})`,
                  pluginId: 'com.community.moviesmod',
                  pluginName: 'Moviesmod (Hollywood & Dual Audio)',
                });
              }
              if (streams.length >= 3) break;
            }
          }
        } catch {}
      }

      // Apply settings sorting
      const preferredServer = this.settings?.preferred_server || 'auto';
      if (preferredServer !== 'auto' && streams.length > 1) {
        streams.sort((a, b) => {
          const aMatch = a.server?.toLowerCase().includes(preferredServer) || a.name?.toLowerCase().includes(preferredServer);
          const bMatch = b.server?.toLowerCase().includes(preferredServer) || b.name?.toLowerCase().includes(preferredServer);
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return 0;
        });
      }

      return streams;
    } catch (err) {
      console.warn('[Moviesmod getSourceStreams] Notice:', err);
      return [];
    }
  },
};
