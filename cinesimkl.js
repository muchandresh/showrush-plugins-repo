/**
 * Showrush CineSimkl Provider (Ported from CSX by SaurabhKaperwan)
 * Dedicated Anime & Global Cinema tracking engine with high-speed multi-server streaming.
 */

function parseAioMetas(metas, defaultBadge = 'ANIME') {
  if (!Array.isArray(metas)) return [];
  return metas.map((meta) => {
    const isTv = meta.type?.includes('series') || meta.type?.includes('anime') || meta.type === 'tv';
    let badge = defaultBadge;
    if (meta.releaseInfo || meta.year) badge = `${meta.releaseInfo || meta.year}`;
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
  id: 'com.community.cinesimkl',
  name: 'CineSimkl (Anime & Global Cinema)',
  version: '2.0.0',
  author: 'Showrush Community (ported from CSX by SaurabhKaperwan)',
  description: 'Simkl & MyAnimeList tracking catalogs (Airing Anime, Top Trending, Global Hits) with fast multi-server streaming.',
  types: ['movie', 'tv', 'anime'],

  // 🌟 Source Offered Catalog: Live Feeds
  async getCatalogFeeds(page = 1) {
    const baseAio = 'https://aiometadata.elfhosted.com/stremio/9197a4a9-2f5b-4911-845e-8704c520bdf7/catalog';

    try {
      const [airingRes, popAnimeRes, trendMovieRes, trendTvRes, topAnimeRes] = await Promise.allSettled([
        Showrush.http.get(`${baseAio}/anime/mal.airing.json`),
        Showrush.http.get(`${baseAio}/anime/mal.popular.json`),
        Showrush.http.get(`${baseAio}/movie/tmdb.trending.json`),
        Showrush.http.get(`${baseAio}/series/tmdb.trending.json`),
        Showrush.http.get(`${baseAio}/anime/mal.topanime.json`),
      ]);

      const feeds = [];

      if (airingRes.status === 'fulfilled' && airingRes.value.ok && airingRes.value.data) {
        const data = typeof airingRes.value.data === 'string' ? JSON.parse(airingRes.value.data) : airingRes.value.data;
        const items = parseAioMetas(data?.metas, 'AIRING');
        if (items.length > 0) {
          feeds.push({
            id: 'simkl-airing-anime',
            title: '⛩️ Airing Today Anime (Simkl/MAL)',
            items: items.slice(0, 18),
          });
        }
      }

      if (popAnimeRes.status === 'fulfilled' && popAnimeRes.value.ok && popAnimeRes.value.data) {
        const data = typeof popAnimeRes.value.data === 'string' ? JSON.parse(popAnimeRes.value.data) : popAnimeRes.value.data;
        const items = parseAioMetas(data?.metas, 'POPULAR');
        if (items.length > 0) {
          feeds.push({
            id: 'simkl-pop-anime',
            title: '🌸 Most Popular Anime Worldwide',
            items: items.slice(0, 18),
          });
        }
      }

      if (trendMovieRes.status === 'fulfilled' && trendMovieRes.value.ok && trendMovieRes.value.data) {
        const data = typeof trendMovieRes.value.data === 'string' ? JSON.parse(trendMovieRes.value.data) : trendMovieRes.value.data;
        const items = parseAioMetas(data?.metas, 'TRENDING');
        if (items.length > 0) {
          feeds.push({
            id: 'simkl-trend-movies',
            title: '🔥 Global Trending Cinema',
            items: items.slice(0, 18),
          });
        }
      }

      if (trendTvRes.status === 'fulfilled' && trendTvRes.value.ok && trendTvRes.value.data) {
        const data = typeof trendTvRes.value.data === 'string' ? JSON.parse(trendTvRes.value.data) : trendTvRes.value.data;
        const items = parseAioMetas(data?.metas, 'TRENDING');
        if (items.length > 0) {
          feeds.push({
            id: 'simkl-trend-series',
            title: '📺 Global Trending Series',
            items: items.slice(0, 18),
          });
        }
      }

      if (topAnimeRes.status === 'fulfilled' && topAnimeRes.value.ok && topAnimeRes.value.data) {
        const data = typeof topAnimeRes.value.data === 'string' ? JSON.parse(topAnimeRes.value.data) : topAnimeRes.value.data;
        const items = parseAioMetas(data?.metas, 'TOP');
        if (items.length > 0) {
          feeds.push({
            id: 'simkl-top-anime',
            title: '🏆 All-Time Top Rated Anime',
            items: items.slice(0, 18),
          });
        }
      }

      return feeds;
    } catch (err) {
      console.warn('[CineSimkl getCatalogFeeds] Notice:', err);
      return [];
    }
  },

  async search(query) {
    if (!query) return [];
    try {
      const res = await Showrush.http.get(
        `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(query)}.json`
      );
      if (res.ok && res.data) {
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        return parseAioMetas(data?.metas);
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
            id: `cinesimkl-${idx + 1}-${Date.now()}`,
            pluginId: 'com.community.cinesimkl',
            pluginName: 'CineSimkl (Anime & Global Cinema)',
            name: `CineSimkl • ${s.server || `Server ${idx + 1}`}`,
            server: `CineSimkl Multi-CDN ${idx + 1}`,
          }));
        }
      } catch (err) {
        console.warn('[CineSimkl Extractor] Notice:', err);
      }
    }

    return [];
  },
};
