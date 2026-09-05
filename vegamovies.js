/**
 * Showrush VegaMovies Provider (Ported from CSX by SaurabhKaperwan)
 * Dual-Audio Bollywood, Hollywood Hindi Dubbed & OTT Releases (Netflix, Prime, Hotstar, K-Drama)
 * Powered by dynamic domain discovery and V-Cloud/HubCloud extractors.
 */

let cachedDomain = null;
let domainFetchTime = 0;

async function getLiveVegaDomain() {
  const now = Date.now();
  if (cachedDomain && now - domainFetchTime < 1000 * 60 * 60) {
    return cachedDomain;
  }

  try {
    const res = await Showrush.http.get(
      'https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (res.ok && res.data) {
      const urls = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (urls.vegamovies) {
        cachedDomain = urls.vegamovies.replace(/\/+$/, '');
        domainFetchTime = now;
        return cachedDomain;
      }
    }
  } catch (err) {
    console.warn('[VegaMovies] Failed to fetch dynamic domain, using fallback:', err);
  }

  cachedDomain = 'https://new2.vegamovies.futbol';
  return cachedDomain;
}

function parseGridItems(elements, defaultBadge = 'HINDI DUB') {
  const items = [];
  for (const el of elements) {
    const href = el.getAttribute('href');
    if (!href) continue;

    const img = el.querySelector('img');
    const rawTitle =
      img?.getAttribute('alt')?.replace(/^Download\s+/i, '') ||
      el.textContent?.trim() ||
      'Movie';
    const poster =
      img?.getAttribute('data-src') ||
      img?.getAttribute('src') ||
      img?.getAttribute('data-lazy-src') ||
      '';

    // Extract quality or series badge
    let badge = defaultBadge;
    if (rawTitle.toLowerCase().includes('season') || rawTitle.toLowerCase().includes('series')) {
      const sMatch = rawTitle.match(/season\s*(\d+)/i);
      badge = sMatch ? `S${sMatch[1]}` : 'SERIES';
    } else if (rawTitle.includes('4K') || rawTitle.includes('2160p')) {
      badge = '4K HDR';
    } else if (rawTitle.includes('1080p')) {
      badge = '1080p';
    }

    items.push({
      id: href,
      title: rawTitle.split(/\[|\(|480p|720p|1080p|2160p/i)[0].trim(),
      poster: poster.startsWith('//') ? `https:${poster}` : poster,
      type: badge.includes('S') || badge === 'SERIES' ? 'tv' : 'movie',
      qualityBadge: badge,
      sourceUrl: href,
    });
  }
  return items;
}

return {
  id: 'com.community.vegamovies',
  name: 'VegaMovies (Hindi & OTT)',
  version: '1.0.0',
  author: 'Showrush Community (ported from CSX by SaurabhKaperwan)',
  description: 'Dual Audio Bollywood, Hollywood Hindi Dubbed, Netflix, Hotstar & Prime Video releases with dynamic domain failover.',
  types: ['movie', 'tv'],
  languages: ['hi'],

  // 🌟 Source Offered Catalog: Live OTT & Cinema Feeds
  async getCatalogFeeds(page = 1) {
    const domain = await getLiveVegaDomain();

    try {
      const [homeRes, netflixRes, primeRes, hotstarRes, koreanRes] = await Promise.allSettled([
        Showrush.http.get(`${domain}/page/${page}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }),
        Showrush.http.get(`${domain}/category/web-series/netflix/page/${page}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }),
        Showrush.http.get(`${domain}/category/web-series/amazon-prime-video/page/${page}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }),
        Showrush.http.get(`${domain}/category/web-series/disney-plus-hotstar/page/${page}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }),
        Showrush.http.get(`${domain}/category/korean-series/page/${page}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }),
      ]);

      const feeds = [];

      // 1. Featured Latest Releases
      if (homeRes.status === 'fulfilled' && homeRes.value.ok && homeRes.value.data) {
        const doc = Showrush.dom.parse(homeRes.value.data);
        const elements = Array.from(doc.querySelectorAll('div.movies-grid > a, article.post a'));
        const items = parseGridItems(elements, 'NEW');
        if (items.length > 0) {
          feeds.push({
            id: 'vega-latest',
            title: '🔥 VegaMovies Latest Releases',
            items: items.slice(0, 18),
          });
        }
      }

      // 2. Netflix Originals & Series
      if (netflixRes.status === 'fulfilled' && netflixRes.value.ok && netflixRes.value.data) {
        const doc = Showrush.dom.parse(netflixRes.value.data);
        const elements = Array.from(doc.querySelectorAll('div.movies-grid > a, article.post a'));
        const items = parseGridItems(elements, 'NETFLIX');
        if (items.length > 0) {
          feeds.push({
            id: 'vega-netflix',
            title: '🍿 Netflix Web Series (Dual Audio)',
            items: items.slice(0, 18),
          });
        }
      }

      // 3. Amazon Prime Video
      if (primeRes.status === 'fulfilled' && primeRes.value.ok && primeRes.value.data) {
        const doc = Showrush.dom.parse(primeRes.value.data);
        const elements = Array.from(doc.querySelectorAll('div.movies-grid > a, article.post a'));
        const items = parseGridItems(elements, 'PRIME');
        if (items.length > 0) {
          feeds.push({
            id: 'vega-prime',
            title: '📦 Amazon Prime Video Releases',
            items: items.slice(0, 18),
          });
        }
      }

      // 4. Disney+ Hotstar
      if (hotstarRes.status === 'fulfilled' && hotstarRes.value.ok && hotstarRes.value.data) {
        const doc = Showrush.dom.parse(hotstarRes.value.data);
        const elements = Array.from(doc.querySelectorAll('div.movies-grid > a, article.post a'));
        const items = parseGridItems(elements, 'HOTSTAR');
        if (items.length > 0) {
          feeds.push({
            id: 'vega-hotstar',
            title: '✨ Disney+ Hotstar Specials',
            items: items.slice(0, 18),
          });
        }
      }

      // 5. Korean Series (Hindi Dubbed)
      if (koreanRes.status === 'fulfilled' && koreanRes.value.ok && koreanRes.value.data) {
        const doc = Showrush.dom.parse(koreanRes.value.data);
        const elements = Array.from(doc.querySelectorAll('div.movies-grid > a, article.post a'));
        const items = parseGridItems(elements, 'K-DRAMA');
        if (items.length > 0) {
          feeds.push({
            id: 'vega-kdrama',
            title: '🌸 Korean Series (Hindi Dubbed)',
            items: items.slice(0, 18),
          });
        }
      }

      return feeds;
    } catch (err) {
      console.warn('[VegaMovies getCatalogFeeds] Notice:', err);
      return [];
    }
  },

  async search(query) {
    if (!query) return [];
    const domain = await getLiveVegaDomain();
    const cleanTitle = query
      .replace(/\b(480p|720p|1080p|2160p|4k|hdr|web-dl|dual audio|hindi|season \d+|s\d+|ep \d+|part \d+)\b/gi, '')
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .trim();

    try {
      // 1. Fast JSON Search API (CSX Standard)
      const searchRes = await Showrush.http.get(
        `${domain}/search.php?q=${encodeURIComponent(cleanTitle || query)}&page=1`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );

      if (searchRes.ok && searchRes.data) {
        const data = typeof searchRes.data === 'string' ? JSON.parse(searchRes.data) : searchRes.data;
        if (data.hits && data.hits.length > 0) {
          return data.hits.map((hit) => {
            const doc = hit.document;
            const fullUrl = doc.permalink.startsWith('http') ? doc.permalink : `${domain}${doc.permalink}`;
            const isTv = doc.category?.some((c) => c.toLowerCase().includes('series') || c.toLowerCase().includes('season'));
            return {
              id: fullUrl,
              title: doc.post_title.replace(/^Download\s+/i, ''),
              poster: doc.post_thumbnail,
              type: isTv ? 'tv' : 'movie',
              url: fullUrl,
              sourceUrl: fullUrl,
            };
          });
        }
      }
    } catch {}

    // Fallback: WordPress HTML Search
    try {
      const searchUrl = `${domain}/?s=${encodeURIComponent(cleanTitle || query)}`;
      const res = await Showrush.http.get(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!res.ok || !res.data) return [];
      const doc = Showrush.dom.parse(res.data);
      const elements = Array.from(doc.querySelectorAll('div.movies-grid > a, article.post a'));
      return parseGridItems(elements).map((item) => ({
        id: item.id,
        title: item.title,
        poster: item.poster,
        type: item.type,
        url: item.sourceUrl,
        sourceUrl: item.sourceUrl,
      }));
    } catch {
      return [];
    }
  },

  async getStreams(query) {
    const { tmdbId, imdbId, title, type = 'movie', season = 1, episode = 1, sourceUrl } = query;

    // 1. Direct sourceUrl resolution ONLY if it belongs to VegaMovies
    if (sourceUrl && (sourceUrl.includes('vegamovies') || (!sourceUrl.includes('moviesdrive') && !sourceUrl.includes('bollyflix') && query.preferredPluginId === 'com.community.vegamovies'))) {
      try {
        const streams = await this.getSourceStreams(sourceUrl, String(episode));
        if (streams.length > 0) return streams;
      } catch {}
    }

    // 2. Search VegaMovies catalog
    if (title) {
      try {
        const searchResults = await this.search(title);
        if (searchResults.length > 0) {
          const target = searchResults[0];
          const streams = await this.getSourceStreams(target.sourceUrl || target.id, String(episode));
          if (streams.length > 0) return streams;
        }
      } catch (err) {
        console.warn('[VegaMovies getStreams] Search notice:', err);
      }
    }

    return [];
  },

  async getSourceDetails(sourceId) {
    try {
      const res = await Showrush.http.get(sourceId);
      if (!res.ok || !res.data) return null;

      const doc = Showrush.dom.parse(res.data);
      const title =
        doc.querySelector('h1.entry-title, h1')?.textContent?.replace(/^Download\s+/i, '').trim() ||
        'Movie Details';
      const poster = doc.querySelector('div.entry-content img, p > img')?.getAttribute('src') || '';
      const overview = doc.querySelector('div.entry-content p')?.textContent?.trim() || '';

      return {
        id: sourceId,
        title,
        poster: poster.startsWith('//') ? `https:${poster}` : poster,
        overview,
        type: 'movie',
      };
    } catch {
      return null;
    }
  },

  async getSourceStreams(sourceId, episode = '1') {
    try {
      const res = await Showrush.http.get(sourceId, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!res.ok || !res.data) return [];

      const html = typeof res.data === 'string' ? res.data : '';
      const streams = [];
      const targetEp = parseInt(episode, 10) || 1;
      const isTv = html.toLowerCase().includes('season') || html.toLowerCase().includes('series');

      // 1. Gather all intermediate download links
      const nexMatches = Array.from(
        html.matchAll(/href=["'](https?:\/\/[^"']*(?:nexdrive|fastdl|vcloud|hubcloud)[^"']*)["']/gi)
      ).map((m) => m[1].replace(/&amp;/g, '&'));

      const uniqueNex = Array.from(new Set(nexMatches)).filter(
        (l) => !l.includes('vegamovies-apk') && !l.includes('apk') && !l.includes('telegram') && !l.includes('comment')
      );

      if (isTv) {
        // TV Series: Find the season nexdrive link containing episode vcloud links
        for (const nex of uniqueNex) {
          if (!nex.includes('nexdrive')) continue;
          try {
            const nRes = await Showrush.http.get(nex, {
              headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': sourceId },
            });
            if (nRes.ok && nRes.data) {
              const nHtml = typeof nRes.data === 'string' ? nRes.data : '';
              const vcloudMatches = Array.from(
                nHtml.matchAll(/href=["'](https?:\/\/[^"']*(?:vcloud|hubcloud)[^"']*)["']/gi)
              ).map((m) => m[1]);

              if (vcloudMatches.length >= targetEp) {
                const epLink = vcloudMatches[targetEp - 1];
                const extracted = await Showrush.extractors.hubcloud(epLink, nex);
                for (const [idx, s] of extracted.entries()) {
                  streams.push({
                    ...s,
                    id: `vega-tv-${idx}-${Date.now()}`,
                    name: `VegaMovies S1 E${targetEp} • ${s.server || 'Direct'}`,
                    server: `VegaMovies (${s.server || 'Direct'})`,
                    pluginId: 'com.community.vegamovies',
                    pluginName: 'VegaMovies (Hindi & OTT)',
                  });
                }
                if (streams.length >= 2) break;
              }
            }
          } catch {}
        }
      }

      // If movie or series episode not resolved above, resolve movie links
      if (streams.length === 0) {
        for (const nex of uniqueNex.slice(0, 4)) {
          try {
            let cloudUrl = nex;
            if (nex.includes('nexdrive')) {
              const nRes = await Showrush.http.get(nex, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': sourceId },
              });
              if (nRes.ok && nRes.data) {
                const nHtml = typeof nRes.data === 'string' ? nRes.data : '';
                const match = nHtml.match(/href=["'](https?:\/\/[^"']*(?:vcloud|hubcloud)[^"']*)["']/i);
                if (match) cloudUrl = match[1];
              }
            }

            if (cloudUrl.includes('vcloud') || cloudUrl.includes('hubcloud')) {
              const extracted = await Showrush.extractors.hubcloud(cloudUrl, nex);
              for (const [idx, s] of extracted.entries()) {
                streams.push({
                  ...s,
                  id: `vega-m-${idx}-${Date.now()}`,
                  name: `VegaMovies • ${s.server || 'Direct'}`,
                  server: `VegaMovies (${s.server || 'Direct'})`,
                  pluginId: 'com.community.vegamovies',
                  pluginName: 'VegaMovies (Hindi & OTT)',
                });
              }
              if (streams.length >= 4) break;
            }
          } catch {}
        }
      }

      return streams;
    } catch (err) {
      console.warn('[VegaMovies getSourceStreams] Notice:', err);
      return [];
    }
  },
};
