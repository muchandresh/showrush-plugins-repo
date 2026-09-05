/**
 * Showrush MoviesDrive Pro Provider (Ported from CSX by SaurabhKaperwan)
 * Dual-Audio Bollywood, Hollywood, Netflix, Prime Video & K-Drama with HubCloud & Pixeldrain direct streaming.
 */

let cachedMdDomain = null;
let domainFetchTime = 0;

async function getLiveMoviesDriveDomain() {
  const now = Date.now();
  if (cachedMdDomain && now - domainFetchTime < 1000 * 60 * 60) {
    return cachedMdDomain;
  }

  try {
    const res = await Showrush.http.get(
      'https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (res.ok && res.data) {
      const urls = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (urls.moviesdrive) {
        cachedMdDomain = urls.moviesdrive.replace(/\/+$/, '');
        domainFetchTime = now;
        return cachedMdDomain;
      }
    }
  } catch (err) {
    console.warn('[MoviesDrive] Failed to fetch dynamic domain, using fallback:', err);
  }

  cachedMdDomain = 'https://new3.moviesdrive.christmas';
  return cachedMdDomain;
}

function parseMoviesDriveGrid(doc, defaultBadge = 'HINDI') {
  const items = [];
  const elements = Array.from(doc.querySelectorAll('#moviesGridMain > a, article.post a, div.post-cards > article a'));

  for (const el of elements) {
    const href = el.getAttribute('href');
    if (!href) continue;

    const img = el.querySelector('img');
    const rawTitle =
      el.querySelector('p')?.textContent?.replace(/^Download\s+/i, '') ||
      img?.getAttribute('alt')?.replace(/^Download\s+/i, '') ||
      el.textContent?.trim() ||
      'Movie';
    const poster =
      img?.getAttribute('src') ||
      img?.getAttribute('data-src') ||
      img?.getAttribute('data-lazy-src') ||
      '';

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
  id: 'com.community.moviesdrive',
  name: 'MoviesDrive (Bollywood & OTT)',
  version: '2.0.0',
  author: 'Showrush Community (ported from CSX)',
  description: 'Dual Audio Bollywood, Hollywood, Netflix, Prime Video, Hotstar & K-Drama releases with direct HubCloud & Pixeldrain streaming.',
  types: ['movie', 'tv', 'anime'],

  // 🌟 Source Offered Catalog: Live Feeds
  async getCatalogFeeds(page = 1) {
    const domain = await getLiveMoviesDriveDomain();

    try {
      const [homeRes, primeRes, netflixRes, hotstarRes, kdramaRes] = await Promise.allSettled([
        Showrush.http.get(`${domain}/page/${page}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        Showrush.http.get(`${domain}/category/amzn-prime-video/page/${page}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        Showrush.http.get(`${domain}/category/netflix/page/${page}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        Showrush.http.get(`${domain}/category/hotstar/page/${page}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        Showrush.http.get(`${domain}/category/k-drama/page/${page}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      ]);

      const feeds = [];

      if (homeRes.status === 'fulfilled' && homeRes.value.ok && homeRes.value.data) {
        const doc = Showrush.dom.parse(homeRes.value.data);
        const items = parseMoviesDriveGrid(doc, 'NEW');
        if (items.length > 0) {
          feeds.push({
            id: 'md-latest',
            title: '🔥 MoviesDrive Latest Releases',
            items: items.slice(0, 18),
          });
        }
      }

      if (netflixRes.status === 'fulfilled' && netflixRes.value.ok && netflixRes.value.data) {
        const doc = Showrush.dom.parse(netflixRes.value.data);
        const items = parseMoviesDriveGrid(doc, 'NETFLIX');
        if (items.length > 0) {
          feeds.push({
            id: 'md-netflix',
            title: '🍿 Netflix Web Series (Hindi Dubbed)',
            items: items.slice(0, 18),
          });
        }
      }

      if (primeRes.status === 'fulfilled' && primeRes.value.ok && primeRes.value.data) {
        const doc = Showrush.dom.parse(primeRes.value.data);
        const items = parseMoviesDriveGrid(doc, 'PRIME');
        if (items.length > 0) {
          feeds.push({
            id: 'md-prime',
            title: '📦 Amazon Prime Video Releases',
            items: items.slice(0, 18),
          });
        }
      }

      if (hotstarRes.status === 'fulfilled' && hotstarRes.value.ok && hotstarRes.value.data) {
        const doc = Showrush.dom.parse(hotstarRes.value.data);
        const items = parseMoviesDriveGrid(doc, 'HOTSTAR');
        if (items.length > 0) {
          feeds.push({
            id: 'md-hotstar',
            title: '✨ Disney+ Hotstar Specials',
            items: items.slice(0, 18),
          });
        }
      }

      if (kdramaRes.status === 'fulfilled' && kdramaRes.value.ok && kdramaRes.value.data) {
        const doc = Showrush.dom.parse(kdramaRes.value.data);
        const items = parseMoviesDriveGrid(doc, 'K-DRAMA');
        if (items.length > 0) {
          feeds.push({
            id: 'md-kdrama',
            title: '🌸 Korean Series (Dual Audio)',
            items: items.slice(0, 18),
          });
        }
      }

      return feeds;
    } catch (err) {
      console.warn('[MoviesDrive getCatalogFeeds] Notice:', err);
      return [];
    }
  },

  async search(query) {
    if (!query) return [];
    const domain = await getLiveMoviesDriveDomain();
    const cleanQuery = query
      .replace(/\b(480p|720p|1080p|2160p|4k|hdr|web-dl|dual audio|hindi|season \d+|s\d+|ep \d+|part \d+)\b/gi, '')
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .trim();

    try {
      const searchRes = await Showrush.http.get(
        `${domain}/search.php?q=${encodeURIComponent(cleanQuery || query)}&page=1`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );

      if (searchRes.ok && searchRes.data) {
        const data = typeof searchRes.data === 'string' ? JSON.parse(searchRes.data) : searchRes.data;
        if (data.hits && data.hits.length > 0) {
          return data.hits.map((hit) => {
            const doc = hit.document;
            const fullUrl = doc.permalink.startsWith('http') ? doc.permalink : `${domain}${doc.permalink}`;
            return {
              id: fullUrl,
              title: doc.post_title.replace(/^Download\s+/i, ''),
              poster: doc.post_thumbnail,
              type: doc.post_title.toLowerCase().includes('season') ? 'tv' : 'movie',
              url: fullUrl,
              sourceUrl: fullUrl,
            };
          });
        }
      }
    } catch {}

    return [];
  },

  async getStreams(query) {
    const { title, type, season = 1, episode = 1, sourceUrl } = query;

    // Direct sourceUrl resolution
    if (sourceUrl && (sourceUrl.includes('moviesdrive') || sourceUrl.startsWith('http'))) {
      const streams = await this.getSourceStreams(sourceUrl, String(episode));
      if (streams.length > 0) return streams;
    }

    if (!title) return [];

    try {
      const searchResults = await this.search(title);
      if (searchResults.length === 0) return [];

      const target = searchResults[0];
      return await this.getSourceStreams(target.sourceUrl || target.id, String(episode));
    } catch (err) {
      console.warn('[MoviesDrive getStreams] Notice:', err);
      return [];
    }
  },

  async getSourceStreams(sourceId, episode = '1') {
    try {
      const res = await Showrush.http.get(sourceId, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!res.ok || !res.data) return [];

      const html = typeof res.data === 'string' ? res.data : '';
      const doc = Showrush.dom.parse(html);
      const streams = [];

      // Extract HubCloud or intermediate redirect links
      const linkMatches = Array.from(
        html.matchAll(/href=["'](https?:\/\/[^"']*(?:hubcloud|vcloud)[^"']*)["']/gi)
      ).map((m) => m[1].replace(/&amp;/g, '&'));

      const uniqueLinks = Array.from(new Set(linkMatches));

      for (const link of uniqueLinks.slice(0, 3)) {
        try {
          if (Showrush.extractors && typeof Showrush.extractors.hubcloud === 'function') {
            const extracted = await Showrush.extractors.hubcloud(link, sourceId);
            if (extracted && extracted.length > 0) {
              for (const [idx, s] of extracted.entries()) {
                streams.push({
                  ...s,
                  id: `md-${idx}-${Date.now()}`,
                  name: `MoviesDrive • ${s.server || 'HubCloud Direct'}`,
                  pluginId: 'com.community.moviesdrive',
                  pluginName: 'MoviesDrive (Bollywood & OTT)',
                });
              }
              if (streams.length >= 2) break;
            }
          }
        } catch {}
      }

      return streams;
    } catch (err) {
      console.warn('[MoviesDrive getSourceStreams] Notice:', err);
      return [];
    }
  },
};
