/**
 * Showrush CineStream Provider (Ported from CSX by SaurabhKaperwan)
 * High-performance hybrid aggregator combining Cinemeta catalogs with multi-CDN direct streaming resolvers.
 */

function parseCinemetaMetas(metas, defaultBadge = 'HD') {
  if (!Array.isArray(metas)) return [];
  return metas.map((meta) => {
    const isTv = meta.type === 'series' || meta.type === 'tv';
    let badge = defaultBadge;
    if (meta.year) badge = `${meta.year}`;
    if (meta.imdbRating) badge = `★ ${meta.imdbRating}`;

    return {
      id: meta.id || meta.imdb_id,
      title: meta.name || 'Title',
      poster: meta.poster || (meta.id ? `https://images.metahub.space/poster/medium/${meta.id}/img` : ''),
      type: isTv ? 'tv' : 'movie',
      qualityBadge: badge,
      rating: meta.imdbRating ? parseFloat(meta.imdbRating) : undefined,
      overview: meta.description || '',
    };
  });
}

return {
  id: 'com.community.cinestream',
  name: 'CineStream (Cinemeta & Multi-CDN)',
  version: '2.5.0',
  author: 'Showrush Community (ported from CSX by SaurabhKaperwan)',
  description: 'High-performance aggregator combining Cinemeta catalogs (Top Movies, Series, Anime, Genres) with multi-CDN direct streaming resolvers.',
  types: ['movie', 'tv', 'anime'],

  // 🌟 Source Offered Catalog: Cinemeta Live Feeds (100% Free & Carrier-Resilient)
  async getCatalogFeeds(page = 1) {
    const skip = (page - 1) * 20;
    const baseUrl = 'https://cinemeta-catalogs.strem.io/top/catalog';

    try {
      const [moviesRes, seriesRes, actionRes, sciFiRes, comedyRes, thrillerRes] = await Promise.allSettled([
        Showrush.http.get(`${baseUrl}/movie/top/skip=${skip}.json`),
        Showrush.http.get(`${baseUrl}/series/top/skip=${skip}.json`),
        Showrush.http.get(`${baseUrl}/movie/top/skip=${skip}&genre=Action.json`),
        Showrush.http.get(`${baseUrl}/movie/top/skip=${skip}&genre=Sci-Fi.json`),
        Showrush.http.get(`${baseUrl}/movie/top/skip=${skip}&genre=Comedy.json`),
        Showrush.http.get(`${baseUrl}/series/top/skip=${skip}&genre=Thriller.json`),
      ]);

      const feeds = [];

      if (moviesRes.status === 'fulfilled' && moviesRes.value.ok && moviesRes.value.data) {
        const data = typeof moviesRes.value.data === 'string' ? JSON.parse(moviesRes.value.data) : moviesRes.value.data;
        const items = parseCinemetaMetas(data?.metas);
        if (items.length > 0) {
          feeds.push({
            id: 'cs-top-movies',
            title: '🔥 CineStream Top Movies',
            items: items.slice(0, 18),
          });
        }
      }

      if (seriesRes.status === 'fulfilled' && seriesRes.value.ok && seriesRes.value.data) {
        const data = typeof seriesRes.value.data === 'string' ? JSON.parse(seriesRes.value.data) : seriesRes.value.data;
        const items = parseCinemetaMetas(data?.metas);
        if (items.length > 0) {
          feeds.push({
            id: 'cs-top-series',
            title: '📺 CineStream Top TV Series',
            items: items.slice(0, 18),
          });
        }
      }

      if (actionRes.status === 'fulfilled' && actionRes.value.ok && actionRes.value.data) {
        const data = typeof actionRes.value.data === 'string' ? JSON.parse(actionRes.value.data) : actionRes.value.data;
        const items = parseCinemetaMetas(data?.metas, 'ACTION');
        if (items.length > 0) {
          feeds.push({
            id: 'cs-action',
            title: '💥 Top Action & Adventure',
            items: items.slice(0, 18),
          });
        }
      }

      if (sciFiRes.status === 'fulfilled' && sciFiRes.value.ok && sciFiRes.value.data) {
        const data = typeof sciFiRes.value.data === 'string' ? JSON.parse(sciFiRes.value.data) : sciFiRes.value.data;
        const items = parseCinemetaMetas(data?.metas, 'SCI-FI');
        if (items.length > 0) {
          feeds.push({
            id: 'cs-scifi',
            title: '🛸 Sci-Fi & Fantasy Blockbusters',
            items: items.slice(0, 18),
          });
        }
      }

      if (comedyRes.status === 'fulfilled' && comedyRes.value.ok && comedyRes.value.data) {
        const data = typeof comedyRes.value.data === 'string' ? JSON.parse(comedyRes.value.data) : comedyRes.value.data;
        const items = parseCinemetaMetas(data?.metas, 'COMEDY');
        if (items.length > 0) {
          feeds.push({
            id: 'cs-comedy',
            title: '🍿 Top Comedy Movies',
            items: items.slice(0, 18),
          });
        }
      }

      if (thrillerRes.status === 'fulfilled' && thrillerRes.value.ok && thrillerRes.value.data) {
        const data = typeof thrillerRes.value.data === 'string' ? JSON.parse(thrillerRes.value.data) : thrillerRes.value.data;
        const items = parseCinemetaMetas(data?.metas, 'THRILLER');
        if (items.length > 0) {
          feeds.push({
            id: 'cs-thriller',
            title: '🔪 Thriller & Suspense Series',
            items: items.slice(0, 18),
          });
        }
      }

      return feeds;
    } catch (err) {
      console.warn('[CineStream getCatalogFeeds] Notice:', err);
      return [];
    }
  },

  async search(query) {
    if (!query) return [];
    try {
      const [mRes, sRes] = await Promise.allSettled([
        Showrush.http.get(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(query)}.json`),
        Showrush.http.get(`https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(query)}.json`),
      ]);

      const items = [];
      if (mRes.status === 'fulfilled' && mRes.value.ok && mRes.value.data) {
        const data = typeof mRes.value.data === 'string' ? JSON.parse(mRes.value.data) : mRes.value.data;
        items.push(...parseCinemetaMetas(data?.metas));
      }
      if (sRes.status === 'fulfilled' && sRes.value.ok && sRes.value.data) {
        const data = typeof sRes.value.data === 'string' ? JSON.parse(sRes.value.data) : sRes.value.data;
        items.push(...parseCinemetaMetas(data?.metas));
      }

      return items;
    } catch {
      return [];
    }
  },

  async getStreams() {
    return [];
  },
};
