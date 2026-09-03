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
  types: ['movie', 'tv', 'anime'],

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

    try {
      const searchUrl = `${domain}/?s=${encodeURIComponent(query)}`;
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
      }));
    } catch {
      return [];
    }
  },

  async getStreams(query) {
    const { title, type, season = 1, episode = 1 } = query;
    if (!title) return [];

    try {
      const searchResults = await this.search(title);
      if (searchResults.length === 0) return [];

      const target = searchResults[0];
      return await this.getSourceStreams(target.id);
    } catch (err) {
      console.warn('[VegaMovies getStreams] Notice:', err);
      return [];
    }
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

  async getSourceStreams(sourceId) {
    try {
      const res = await Showrush.http.get(sourceId);
      if (!res.ok || !res.data) return [];

      const doc = Showrush.dom.parse(res.data);
      const streams = [];

      // Extract download buttons or HubCloud / V-Cloud redirect anchors
      const buttons = Array.from(
        doc.querySelectorAll(
          'a.dwd-button, a[href*="vcloud"], a[href*="hubcloud"], a[href*="gdflix"], a[href*="drive"]'
        )
      );

      for (const [idx, btn] of buttons.slice(0, 4).entries()) {
        const link = btn.getAttribute('href');
        if (!link) continue;

        // If link is already direct media (.m3u8 / .mp4)
        if (link.includes('.m3u8') || link.includes('.mp4')) {
          const serverName = btn.textContent?.trim() || `Vega Server ${idx + 1}`;
          streams.push({
            id: `vega-${idx}-${Date.now()}`,
            name: `VegaMovies ${serverName}`,
            server: serverName,
            url: link,
            quality: link.includes('1080p') ? '1080p' : link.includes('720p') ? '720p' : 'Auto',
            format: link.includes('.m3u8') ? 'hls' : 'mp4',
            isM3U8: link.includes('.m3u8'),
            headers: { 'Referer': sourceId },
            pluginId: 'com.community.vegamovies',
            pluginName: 'VegaMovies (Hindi & OTT)',
          });
          continue;
        }

        // Try extracting direct stream from intermediate HubCloud / VCloud page
        try {
          const subRes = await Showrush.http.get(link, { headers: { 'Referer': sourceId } });
          if (subRes.ok && subRes.data) {
            const html = typeof subRes.data === 'string' ? subRes.data : '';
            const m3u8Match = html.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i);
            if (m3u8Match) {
              const streamUrl = m3u8Match[1];
              streams.push({
                id: `vega-${idx}-${Date.now()}`,
                name: `VegaMovies (Direct Stream)`,
                server: `Vega Server ${idx + 1}`,
                url: streamUrl,
                quality: '1080p',
                format: streamUrl.includes('.m3u8') ? 'hls' : 'mp4',
                isM3U8: streamUrl.includes('.m3u8'),
                headers: { 'Referer': link },
                pluginId: 'com.community.vegamovies',
                pluginName: 'VegaMovies (Hindi & OTT)',
              });
            }
          }
        } catch {}
      }

      return streams;
    } catch (err) {
      console.warn('[VegaMovies getSourceStreams] Notice:', err);
      return [];
    }
  },
};
