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

  async getStreams(query) {
    const { tmdbId, imdbId, title, type = 'movie', season = 1, episode = 1 } = query;
    let targetTmdbId = tmdbId;
    let targetImdbId = imdbId;

    // 1. Fallback title lookup if both IDs are missing
    if (!targetImdbId && (title || targetTmdbId)) {
      try {
        const isTv = type === 'tv' || type === 'series';
        const searchTitle = title || (targetTmdbId ? String(targetTmdbId) : '');
        if (searchTitle) {
          const searchRes = await Showrush.http.get(
            `https://v3-cinemeta.strem.io/catalog/${isTv ? 'series' : 'movie'}/top/search=${encodeURIComponent(searchTitle)}.json`
          );
          if (searchRes.ok && searchRes.data) {
            const data = typeof searchRes.data === 'string' ? JSON.parse(searchRes.data) : searchRes.data;
            if (Array.isArray(data?.metas) && data.metas.length > 0) {
              targetImdbId = data.metas[0].id || data.metas[0].imdb_id;
            }
          }
        }
      } catch {}
    }

    if (!targetTmdbId && !targetImdbId && !title) return [];

    const streams = [];

    // 2. Resolve direct multi-server HLS streams via Showrush Universal Extractor (VidSrc & Vidplay)
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
          for (const [idx, s] of sources.entries()) {
            streams.push({
              ...s,
              id: `cs-vidsrc-${idx + 1}-${Date.now()}`,
              pluginId: 'com.community.cinestream',
              pluginName: 'CineStream (Cinemeta & Multi-CDN)',
              name: `CineStream • ${s.server || `Server ${idx + 1}`}`,
              server: `CineStream (${s.server || 'Direct CDN'})`,
            });
          }
        }
      } catch (err) {
        console.warn('[CineStream Extractor] Notice:', err);
      }
    }

    // 3. Stremio Addon Scraper (Torrentio & Custom Addons from CineStream Settings)
    const stremioAddonsRaw = this.settings?.stremio_addons || 'https://torrentio.strem.fun';
    const debridApiKey = (this.settings?.realdebrid_api_key || this.settings?.debridApiKey || '').trim();
    const enableTorrentio = this.settings?.p_torrentio !== false;
    const targetAddonId = targetImdbId || (targetTmdbId && String(targetTmdbId).startsWith('tt') ? targetTmdbId : null);

    if (enableTorrentio && targetAddonId) {
      const addonUrls = stremioAddonsRaw.split(/[\n,]+/).map((u) => u.trim()).filter(Boolean);
      const isTv = type === 'tv' || type === 'series';
      const streamPath = isTv
        ? `series/${targetAddonId}:${season}:${episode}.json`
        : `movie/${targetAddonId}.json`;

      for (const addonBase of addonUrls.slice(0, 2)) {
        try {
          let cleanBase = addonBase.replace(/\/+$/, '').replace(/\/manifest\.json$/, '');
          if (cleanBase.includes('torrentio.strem.fun') && debridApiKey && !cleanBase.includes('realdebrid=')) {
            cleanBase = `${cleanBase}/realdebrid=${encodeURIComponent(debridApiKey)}`;
          }
          const stremioRes = await Showrush.http.get(`${cleanBase}/stream/${streamPath}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });

          if (stremioRes.ok && stremioRes.data) {
            const data = typeof stremioRes.data === 'string' ? JSON.parse(stremioRes.data) : stremioRes.data;
            const addonStreams = Array.isArray(data?.streams) ? data.streams : [];

            for (const [idx, st] of addonStreams.slice(0, 5).entries()) {
              if (st.url) {
                streams.push({
                  id: `cs-stremio-${idx}-${Date.now()}`,
                  pluginId: 'com.community.cinestream',
                  pluginName: 'CineStream (Cinemeta & Multi-CDN)',
                  name: `CineStream • ${st.title?.split('\n')[0] || st.name || `Addon Stream ${idx + 1}`}`,
                  server: st.name || 'Stremio Addon CDN',
                  url: st.url,
                  quality: st.name?.includes('4k') || st.name?.includes('2160p') ? '4K' : '1080p',
                  format: st.url.includes('.m3u8') ? 'hls' : 'mp4',
                  isM3U8: st.url.includes('.m3u8'),
                });
              } else if (st.infoHash) {
                const magnetUrl = `magnet:?xt=urn:btih:${st.infoHash}&dn=${encodeURIComponent(st.title || title || 'Media')}`;
                streams.push({
                  id: `cs-torrent-${st.infoHash.slice(0, 8)}-${Date.now()}`,
                  pluginId: 'com.community.cinestream',
                  pluginName: 'CineStream (Cinemeta & Multi-CDN)',
                  name: `CineStream Torrentio • ${st.title?.split('\n')[0] || st.name || 'P2P Stream'}`,
                  server: debridApiKey ? 'Real-Debrid Torrent Cache' : 'Torrentio P2P',
                  url: magnetUrl,
                  quality: st.name?.includes('4k') ? '4K' : '1080p',
                  format: 'mp4',
                  isM3U8: false,
                });
              }
            }
          }
        } catch {}
      }
    }

    // 4. Apply CineStream quality preference settings
    const preferredQuality = (this.settings?.preferred_quality || 'auto').toLowerCase();
    if (preferredQuality !== 'auto' && streams.length > 1) {
      streams.sort((a, b) => {
        const aQual = (a.quality || '').toLowerCase() === preferredQuality;
        const bQual = (b.quality || '').toLowerCase() === preferredQuality;
        if (aQual && !bQual) return -1;
        if (!aQual && bQual) return 1;
        return 0;
      });
    }

    return streams;
  },
};
