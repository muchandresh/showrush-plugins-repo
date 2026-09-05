/**
 * Showrush Ani-DB Anime Provider
 * Direct Anime Streaming Extractor with Japanese Romaji title mapping, SUB/DUB audio, and WebVTT subtitles.
 */

return {
  id: "com.community.anidb",
  name: "Ani-DB Anime (Sub/Dub)",
  version: "2.0.0",
  author: "Showrush Community",
  description: "Dedicated high-speed Anime streaming provider with Japanese Romaji lookup, SUB & DUB audio, and WebVTT captions.",
  types: ["anime"],
  languages: ["ja", "en"],

  async getStreams(query) {
    const { tmdbId, imdbId, title, type = 'tv', season = 1, episode = 1 } = query;
    if (!title && !tmdbId && !imdbId) return [];

    try {
      const BASE = 'https://epeng.animeapps.top';
      let targetId = query.anilistId;
      if (!targetId && title && Showrush?.anime?.getMapping) {
        try {
          const m = await Showrush.anime.getMapping(title);
          if (m && m.anilistId) targetId = m.anilistId;
        } catch {}
      }
      if (!targetId) return [];

      const epNum = Number(episode) || 1;
      const serversRes = await http.get(`${BASE}/api2.php?epid=${targetId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!serversRes.ok || !Array.isArray(serversRes.data)) return [];

      const epPad = String(epNum).padStart(2, '0');
      const epTargets = [];

      for (const group of serversRes.data) {
        const isDub = /dub/i.test(group.server_name || '');
        const audio = isDub ? 'Dub' : 'Sub';
        for (const ep of group.server_data || []) {
          if (Number(ep.name) === epNum || ep.slug === epPad || ep.name === String(epNum)) {
            if (ep.link) {
              epTargets.push({ link: ep.link, audio });
              break;
            }
          }
        }
      }

      if (epTargets.length === 0) return [];

      const streams = [];
      for (const target of epTargets) {
        try {
          const linksRes = await http.get(`${BASE}/apilink.php?data=${encodeURIComponent(target.link)}`, {
            headers: { Accept: 'application/json' },
          });
          if (!linksRes.ok || !Array.isArray(linksRes.data)) continue;

          for (const [idx, srv] of linksRes.data.entries()) {
            if (!srv.link) continue;
            const origin = new URL(srv.link).origin;
            const htmlRes = await http.get(srv.link, {
              headers: { Referer: `${origin}/`, 'User-Agent': 'Mozilla/5.0' },
            });
            if (!htmlRes.ok || typeof htmlRes.data !== 'string') continue;

            const m = htmlRes.data.match(/videoUrl\s*:\s*["\x27]([^"\x27]+)["\x27]/);
            if (m) {
              const raw = m[1];
              const streamUrl = raw.startsWith('http') ? raw : `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
              if (!streams.some((s) => s.url === streamUrl)) {
                streams.push({
                  id: `anidb-${target.audio.toLowerCase()}-${idx}-${Date.now()}`,
                  pluginId: 'com.community.anidb',
                  pluginName: 'Ani-DB Anime (Sub/Dub)',
                  name: `Ani-DB ${srv.server || 'Primary'} (${target.audio} 1080p)`,
                  server: `Ani-DB ${srv.server || 'Server'} [${target.audio}]`,
                  url: streamUrl,
                  quality: '1080p',
                  format: 'hls',
                  isM3U8: true,
                  headers: { Referer: `${origin}/` },
                });
              }
            }
          }
        } catch {}
      }

      return streams;
    } catch (err) {
      console.warn('[Ani-DB Provider] Error:', err);
      return [];
    }
  },

  // 🌟 Source Offered Catalog: Live AniList Simulcasts & Trending Anime
  async getCatalogFeeds(page = 1) {
    try {
      const gqlQuery = `
        query ($page: Int) {
          trending: Page(page: $page, perPage: 16) {
            media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
              id
              title { romaji english }
              coverImage { extraLarge large }
              format
              episodes
              averageScore
              seasonYear
            }
          }
          airing: Page(page: $page, perPage: 16) {
            media(sort: POPULARITY_DESC, status: RELEASING, type: ANIME, isAdult: false) {
              id
              title { romaji english }
              coverImage { extraLarge large }
              format
              episodes
              averageScore
              nextAiringEpisode { episode }
            }
          }
          popular: Page(page: $page, perPage: 16) {
            media(sort: SCORE_DESC, type: ANIME, isAdult: false) {
              id
              title { romaji english }
              coverImage { extraLarge large }
              format
              episodes
              averageScore
            }
          }
        }
      `;

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: gqlQuery, variables: { page } }),
      });

      if (!res.ok) return [];
      const json = await res.json();
      const data = json?.data;
      if (!data) return [];

      const feeds = [];

      // 1. Trending Simulcasts
      if (data.trending?.media?.length > 0) {
        feeds.push({
          id: 'trending-simulcasts',
          title: '🔥 Trending This Week (Live Simulcasts)',
          items: data.trending.media.map((m) => {
            const title = m.title?.english || m.title?.romaji || 'Anime';
            return {
              id: `anilist-${m.id}`,
              title,
              poster: m.coverImage?.extraLarge || m.coverImage?.large,
              type: 'anime',
              qualityBadge: m.format || 'TV',
              year: m.seasonYear ? String(m.seasonYear) : undefined,
              rating: m.averageScore ? m.averageScore / 10 : 8.5,
            };
          }),
        });
      }

      // 2. Currently Airing Seasons
      if (data.airing?.media?.length > 0) {
        feeds.push({
          id: 'airing-now',
          title: '⚡ Currently Airing Broadcasts',
          items: data.airing.media.map((m) => {
            const title = m.title?.english || m.title?.romaji || 'Anime';
            const epBadge = m.nextAiringEpisode?.episode ? `EP ${m.nextAiringEpisode.episode}` : 'AIRING';
            return {
              id: `anilist-${m.id}`,
              title,
              poster: m.coverImage?.extraLarge || m.coverImage?.large,
              type: 'anime',
              qualityBadge: epBadge,
              rating: m.averageScore ? m.averageScore / 10 : 8.0,
            };
          }),
        });
      }

      // 3. Highest Rated All-Time
      if (data.popular?.media?.length > 0) {
        feeds.push({
          id: 'top-rated',
          title: '👑 Highest Rated Masterpieces',
          items: data.popular.media.map((m) => {
            const title = m.title?.english || m.title?.romaji || 'Anime';
            return {
              id: `anilist-${m.id}`,
              title,
              poster: m.coverImage?.extraLarge || m.coverImage?.large,
              type: 'anime',
              qualityBadge: 'TOP',
              rating: m.averageScore ? m.averageScore / 10 : 9.0,
            };
          }),
        });
      }

      return feeds;
    } catch (err) {
      console.warn('[Ani-DB getCatalogFeeds] Notice:', err);
      return [];
    }
  },

  async getSourceDetails(sourceId) {
    try {
      const res = await Showrush.http.get(`https://api.consumet.org/anime/gogoanime/info/${encodeURIComponent(sourceId)}`);
      if (res.ok && res.data) {
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        return {
          id: data.id,
          title: data.title,
          poster: data.image,
          type: 'anime',
          overview: data.description,
          year: data.releaseDate,
          genres: data.genres || [],
          episodes: (data.episodes || []).map((ep) => ({
            id: ep.id,
            episodeNumber: ep.number,
            title: `Episode ${ep.number}`,
          })),
        };
      }
    } catch {}
    return null;
  },

  async getSourceStreams(sourceId, episodeId) {
    const epTarget = episodeId || `${sourceId}-episode-1`;
    try {
      const res = await Showrush.http.get(`https://api.consumet.org/anime/gogoanime/watch/${encodeURIComponent(epTarget)}`);
      if (res.ok && res.data) {
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        const sources = data.sources || [];
        return sources.map((s, idx) => ({
          id: `gogo-${idx}-${Date.now()}`,
          name: `Ani-DB Mirror #${idx + 1} (${s.quality || 'Auto'})`,
          server: `GogoStream ${s.quality || 'HD'}`,
          url: s.url,
          quality: s.quality || '1080p',
          format: s.isM3U8 ? 'hls' : 'mp4',
          isM3U8: s.isM3U8 ?? s.url.includes('.m3u8'),
          headers: { 'Referer': 'https://gogoanime3.co/' },
          subtitles: (data.subtitles || []).map((sub) => ({
            label: sub.lang || 'English',
            lang: (sub.lang || 'en').toLowerCase().slice(0, 2),
            url: sub.url,
          })),
          pluginId: 'com.community.anidb',
          pluginName: 'Ani-DB Anime (Sub/Dub)',
        }));
      }
    } catch {}
    return [];
  },
};
