/**
 * Showrush CineTmdb Provider (Ported from CSX by SaurabhKaperwan)
 * OTT Network Catalogs (Netflix, Prime, Hotstar, Indian Cinema, K-Drama) with high-speed multi-server streaming.
 */

const TMDB_API_KEY = 'e12338cf94553b9423b0a701fa1103f6';
const TMDB_BASE = 'https://api.themoviedb.org/3';

function mapTmdbResults(results, defaultBadge = 'TMDb') {
  if (!Array.isArray(results)) return [];
  return results.map((item) => {
    const isTv = item.media_type === 'tv' || Boolean(item.first_air_date);
    const title = item.title || item.name || 'Untitled';
    const date = item.release_date || item.first_air_date || '';
    const year = date ? date.split('-')[0] : '';

    let badge = defaultBadge;
    if (year) badge = year;
    if (item.vote_average) badge = `★ ${item.vote_average.toFixed(1)}`;

    return {
      id: String(item.id),
      title,
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
      type: isTv ? 'tv' : 'movie',
      qualityBadge: badge,
      rating: item.vote_average,
      overview: item.overview || '',
    };
  });
}

return {
  id: 'com.community.cinetmdb',
  name: 'CineTmdb (OTT & Indian Cinema)',
  version: '2.0.0',
  author: 'Showrush Community (ported from CSX by SaurabhKaperwan)',
  description: 'OTT Network catalogs (Netflix, Prime, Hotstar, Indian Cinema, Korean Series) with fast multi-server streaming.',
  types: ['movie', 'tv', 'anime'],

  // 🌟 Source Offered Catalog: Live Feeds
  async getCatalogFeeds(page = 1) {
    try {
      const [indianRes, netflixRes, primeRes, hotstarRes, koreanRes] = await Promise.allSettled([
        Showrush.http.get(
          `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&with_origin_country=IN&page=${page}`
        ),
        Showrush.http.get(
          `${TMDB_BASE}/discover/tv?api_key=${TMDB_API_KEY}&with_networks=213&sort_by=popularity.desc&page=${page}`
        ),
        Showrush.http.get(
          `${TMDB_BASE}/discover/tv?api_key=${TMDB_API_KEY}&with_networks=1024&sort_by=popularity.desc&page=${page}`
        ),
        Showrush.http.get(
          `${TMDB_BASE}/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=2336&watch_region=IN&page=${page}`
        ),
        Showrush.http.get(
          `${TMDB_BASE}/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ko&sort_by=popularity.desc&page=${page}`
        ),
      ]);

      const feeds = [];

      if (indianRes.status === 'fulfilled' && indianRes.value.ok && indianRes.value.data) {
        const data = typeof indianRes.value.data === 'string' ? JSON.parse(indianRes.value.data) : indianRes.value.data;
        const items = mapTmdbResults(data?.results, 'INDIA');
        if (items.length > 0) {
          feeds.push({
            id: 'cinetmdb-indian',
            title: '🇮🇳 Trending Indian Cinema (Bollywood & South)',
            items: items.slice(0, 18),
          });
        }
      }

      if (netflixRes.status === 'fulfilled' && netflixRes.value.ok && netflixRes.value.data) {
        const data = typeof netflixRes.value.data === 'string' ? JSON.parse(netflixRes.value.data) : netflixRes.value.data;
        const items = mapTmdbResults(data?.results, 'NETFLIX');
        if (items.length > 0) {
          feeds.push({
            id: 'cinetmdb-netflix',
            title: '🍿 Netflix Originals & Global Series',
            items: items.slice(0, 18),
          });
        }
      }

      if (primeRes.status === 'fulfilled' && primeRes.value.ok && primeRes.value.data) {
        const data = typeof primeRes.value.data === 'string' ? JSON.parse(primeRes.value.data) : primeRes.value.data;
        const items = mapTmdbResults(data?.results, 'PRIME');
        if (items.length > 0) {
          feeds.push({
            id: 'cinetmdb-prime',
            title: '📦 Amazon Prime Video Releases',
            items: items.slice(0, 18),
          });
        }
      }

      if (hotstarRes.status === 'fulfilled' && hotstarRes.value.ok && hotstarRes.value.data) {
        const data = typeof hotstarRes.value.data === 'string' ? JSON.parse(hotstarRes.value.data) : hotstarRes.value.data;
        const items = mapTmdbResults(data?.results, 'HOTSTAR');
        if (items.length > 0) {
          feeds.push({
            id: 'cinetmdb-hotstar',
            title: '✨ Disney+ Hotstar Specials',
            items: items.slice(0, 18),
          });
        }
      }

      if (koreanRes.status === 'fulfilled' && koreanRes.value.ok && koreanRes.value.data) {
        const data = typeof koreanRes.value.data === 'string' ? JSON.parse(koreanRes.value.data) : koreanRes.value.data;
        const items = mapTmdbResults(data?.results, 'K-DRAMA');
        if (items.length > 0) {
          feeds.push({
            id: 'cinetmdb-korean',
            title: '🌸 Korean Drama Series',
            items: items.slice(0, 18),
          });
        }
      }

      return feeds;
    } catch (err) {
      console.warn('[CineTmdb getCatalogFeeds] Notice:', err);
      return [];
    }
  },

  async search(query) {
    if (!query) return [];
    try {
      const res = await Showrush.http.get(
        `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
      );
      if (res.ok && res.data) {
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        return mapTmdbResults(data?.results);
      }
      return [];
    } catch {
      return [];
    }
  },

  async getStreams(query) {
    const { tmdbId, imdbId, title, type = 'movie', season = 1, episode = 1 } = query;
    let targetTmdbId = tmdbId;
    let targetImdbId = imdbId;

    if (!targetTmdbId && !targetImdbId && title) {
      try {
        const searchRes = await this.search(title);
        if (searchRes.length > 0 && searchRes[0].id) {
          if (String(searchRes[0].id).startsWith('tt')) {
            targetImdbId = searchRes[0].id;
          } else {
            targetTmdbId = searchRes[0].id;
          }
        }
      } catch {}
    }

    if (!targetTmdbId && !targetImdbId && !title) return [];

    if (Showrush?.extractors?.vidsrc) {
      try {
        const sources = await Showrush.extractors.vidsrc({
          tmdbId: targetTmdbId,
          imdbId: targetImdbId,
          title,
          type,
          season,
          episode,
        });

        if (Array.isArray(sources) && sources.length > 0) {
          return sources.map((s, idx) => ({
            ...s,
            id: `cinetmdb-${idx + 1}-${Date.now()}`,
            pluginId: 'com.community.cinetmdb',
            pluginName: 'CineTmdb (OTT & Indian Cinema)',
            name: `CineTmdb • ${s.server || `Server ${idx + 1}`}`,
            server: `CineTmdb OTT Stream ${idx + 1}`,
          }));
        }
      } catch (err) {
        console.warn('[CineTmdb Extractor] Notice:', err);
      }
    }

    return [];
  },
};
