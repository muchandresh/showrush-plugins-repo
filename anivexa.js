/**
 * Anivexa Anime Engine Pro Plugin
 * Ultimate Anime streaming powerhouse featuring real-time seasonal simulcasts,
 * AniList GraphQL trending charts, genre exploration, and multi-server Sub/Dub HLS playback.
 */

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';
const ANIMEAPPS_BASE = 'https://epeng.animeapps.top';

async function queryAniList(query, variables = {}) {
  try {
    const res = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch (err) {
    console.warn('[Anivexa Plugin] AniList GraphQL notice:', err);
    return null;
  }
}

function cleanHtml(html) {
  return html ? html.replace(/<[^>]*>?/gm, '').trim() : '';
}

function extractId(rawId) {
  if (!rawId) return null;
  const str = String(rawId).replace(/^anilist-/, '');
  const num = parseInt(str, 10);
  return isNaN(num) ? null : num;
}

return {
  id: 'com.community.anivexa',
  name: 'Anivexa Anime Engine Pro',
  version: '1.0.0',
  author: 'Anivexa Community',
  description:
    'Ultimate Anime streaming powerhouse featuring real-time seasonal simulcasts, AniList GraphQL trending charts, genre exploration, and multi-server Sub/Dub HLS playback.',
  category: 'pro_plugin',
  types: ['anime'],
  languages: ['ja', 'en', 'all'],

  // ==========================================
  // 1. Live Catalog Feeds (AniList GraphQL)
  // ==========================================
  async getCatalogFeeds(page = 1) {
    try {
      const gqlQuery = `
        query ($page: Int) {
          trending: Page(page: $page, perPage: 18) {
            media(sort: [TRENDING_DESC, POPULARITY_DESC], type: ANIME, isAdult: false) {
              id
              title { romaji english }
              coverImage { extraLarge large }
              bannerImage
              format
              episodes
              averageScore
              seasonYear
              description
            }
          }
          airing: Page(page: $page, perPage: 18) {
            media(sort: POPULARITY_DESC, status: RELEASING, type: ANIME, isAdult: false) {
              id
              title { romaji english }
              coverImage { extraLarge large }
              bannerImage
              format
              episodes
              averageScore
              seasonYear
              description
              nextAiringEpisode { episode }
            }
          }
          topRated: Page(page: $page, perPage: 18) {
            media(sort: SCORE_DESC, type: ANIME, isAdult: false) {
              id
              title { romaji english }
              coverImage { extraLarge large }
              bannerImage
              format
              episodes
              averageScore
              seasonYear
              description
            }
          }
          movies: Page(page: $page, perPage: 18) {
            media(sort: POPULARITY_DESC, format: MOVIE, type: ANIME, isAdult: false) {
              id
              title { romaji english }
              coverImage { extraLarge large }
              bannerImage
              format
              averageScore
              seasonYear
              description
            }
          }
          action: Page(page: $page, perPage: 16) {
            media(genre: "Action", sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
              id
              title { romaji english }
              coverImage { extraLarge large }
              bannerImage
              format
              episodes
              averageScore
              seasonYear
              description
            }
          }
          fantasy: Page(page: $page, perPage: 16) {
            media(genre: "Fantasy", sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
              id
              title { romaji english }
              coverImage { extraLarge large }
              bannerImage
              format
              episodes
              averageScore
              seasonYear
              description
            }
          }
        }
      `;

      const data = await queryAniList(gqlQuery, { page });
      if (!data) return [];

      const mapMediaItem = (m, customBadge) => {
        const title = m.title?.english || m.title?.romaji || 'Anime';
        const isMovie = m.format === 'MOVIE';
        return {
          id: `anilist-${m.id}`,
          title,
          poster: m.coverImage?.extraLarge || m.coverImage?.large,
          backdrop: m.bannerImage || m.coverImage?.extraLarge,
          type: isMovie ? 'movie' : 'anime',
          qualityBadge: customBadge || (isMovie ? 'MOVIE' : 'SUB / DUB'),
          year: m.seasonYear ? String(m.seasonYear) : undefined,
          rating: m.averageScore ? m.averageScore / 10 : 8.5,
          overview: cleanHtml(m.description),
          sourceUrl: `anilist-${m.id}`,
          episodes: m.episodes || (isMovie ? 1 : 12),
        };
      };

      const feeds = [];

      // 1. Trending Simulcasts
      if (data.trending?.media?.length > 0) {
        feeds.push({
          id: 'anivexa-trending',
          title: '🔥 Trending & Hyped Anime (Live Simulcasts)',
          items: data.trending.media.map((m) => mapMediaItem(m, 'TRENDING')),
        });
      }

      // 2. Airing This Season
      if (data.airing?.media?.length > 0) {
        feeds.push({
          id: 'anivexa-airing',
          title: '📅 Airing This Season (Japanese TV)',
          items: data.airing.media.map((m) => {
            const badge = m.nextAiringEpisode?.episode
              ? `EP ${m.nextAiringEpisode.episode}`
              : 'AIRING';
            return mapMediaItem(m, badge);
          }),
        });
      }

      // 3. All-Time Top Rated Masterpieces
      if (data.topRated?.media?.length > 0) {
        feeds.push({
          id: 'anivexa-top-rated',
          title: '👑 All-Time Top Rated Masterpieces',
          items: data.topRated.media.map((m) => mapMediaItem(m, 'MASTERPIECE')),
        });
      }

      // 4. Theatrical Blockbusters
      if (data.movies?.media?.length > 0) {
        feeds.push({
          id: 'anivexa-movies',
          title: '🍿 Theatrical Anime Blockbusters',
          items: data.movies.media.map((m) => mapMediaItem(m, '1080p MOVIE')),
        });
      }

      // 5. Shonen & Action Battles
      if (data.action?.media?.length > 0) {
        feeds.push({
          id: 'anivexa-action',
          title: '⚔️ Shonen & Action Battles',
          items: data.action.media.map((m) => mapMediaItem(m, 'ACTION')),
        });
      }

      // 6. Fantasy & Isekai Worlds
      if (data.fantasy?.media?.length > 0) {
        feeds.push({
          id: 'anivexa-fantasy',
          title: '🧙 Fantasy & Isekai Worlds',
          items: data.fantasy.media.map((m) => mapMediaItem(m, 'FANTASY')),
        });
      }

      return feeds;
    } catch (err) {
      console.warn('[Anivexa getCatalogFeeds] Error:', err);
      return [];
    }
  },

  // ==========================================
  // 2. Search Handler (Titles & Genres)
  // ==========================================
  async search(query) {
    if (!query || !query.trim()) return [];
    try {
      const gqlQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 24) {
            media(search: $search, type: ANIME, isAdult: false) {
              id
              title { romaji english native }
              coverImage { extraLarge large }
              format
              episodes
              averageScore
              seasonYear
              description
            }
          }
        }
      `;

      const data = await queryAniList(gqlQuery, { search: query.trim() });
      const list = data?.Page?.media || [];

      return list.map((m) => {
        const title = m.title?.english || m.title?.romaji || 'Anime';
        return {
          id: `anilist-${m.id}`,
          title,
          poster: m.coverImage?.extraLarge || m.coverImage?.large,
          type: m.format === 'MOVIE' ? 'movie' : 'anime',
          year: m.seasonYear || undefined,
          rating: m.averageScore ? m.averageScore / 10 : 8.5,
          overview: cleanHtml(m.description),
          url: `anilist-${m.id}`,
        };
      });
    } catch (err) {
      console.warn('[Anivexa search] Error:', err);
      return [];
    }
  },

  // ==========================================
  // 3. Anime Details & Episode Guide
  // ==========================================
  async getSourceDetails(sourceId) {
    const rawId = extractId(sourceId);
    if (!rawId) return null;

    try {
      const gqlQuery = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            idMal
            title { romaji english native }
            bannerImage
            coverImage { extraLarge large }
            description
            format
            status
            episodes
            averageScore
            genres
            seasonYear
            startDate { year }
          }
        }
      `;

      const data = await queryAniList(gqlQuery, { id: rawId });
      const media = data?.Media;
      if (!media) return null;

      const title = media.title?.english || media.title?.romaji || 'Anime';
      const isMovie = media.format === 'MOVIE';
      const episodeCount = media.episodes || (isMovie ? 1 : 12);

      const episodes = Array.from({ length: episodeCount }, (_, idx) => {
        const epNum = idx + 1;
        return {
          id: String(epNum),
          episodeNumber: epNum,
          seasonNumber: 1,
          title: `Episode ${epNum}`,
          thumbnail: media.coverImage?.extraLarge || media.bannerImage,
          overview: `Episode ${epNum} of ${title}`,
        };
      });

      return {
        id: `anilist-${media.id}`,
        title,
        poster: media.coverImage?.extraLarge || media.coverImage?.large,
        backdrop: media.bannerImage || media.coverImage?.extraLarge,
        type: isMovie ? 'movie' : 'anime',
        overview: cleanHtml(media.description),
        year: String(media.seasonYear || media.startDate?.year || ''),
        rating: media.averageScore ? media.averageScore / 10 : 8.5,
        genres: media.genres || [],
        episodes,
      };
    } catch (err) {
      console.warn('[Anivexa getSourceDetails] Error:', err);
      return null;
    }
  },

  // ==========================================
  // 4. Multi-Server Sub/Dub Video Streams
  // ==========================================
  async getSourceStreams(sourceId, episodeId = '1') {
    const rawId = extractId(sourceId);
    const epNum = parseInt(String(episodeId), 10) || 1;
    if (!rawId) return [];

    const streams = [];

    // Mirror 1: AnimeApps High-Speed Sub/Dub Mirror
    try {
      const serversRes = await Showrush.http.get(`${ANIMEAPPS_BASE}/api2.php?epid=${rawId}`, {
        headers: { Accept: 'application/json' },
      });

      if (serversRes.ok && Array.isArray(serversRes.data)) {
        const epTargets = [];
        const epPad = String(epNum).padStart(2, '0');

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

        for (const target of epTargets) {
          try {
            const linksRes = await Showrush.http.get(
              `${ANIMEAPPS_BASE}/apilink.php?data=${encodeURIComponent(target.link)}`,
              { headers: { Accept: 'application/json' } }
            );

            if (linksRes.ok && Array.isArray(linksRes.data)) {
              for (const [idx, srv] of linksRes.data.entries()) {
                if (!srv.link) continue;
                const origin = new URL(srv.link).origin;

                const htmlRes = await Showrush.http.get(srv.link, {
                  headers: { Referer: `${origin}/`, 'User-Agent': 'Mozilla/5.0' },
                });

                if (htmlRes.ok && typeof htmlRes.data === 'string') {
                  const m = htmlRes.data.match(/videoUrl\s*:\s*["\x27]([^"\x27]+)["\x27]/);
                  if (m) {
                    const raw = m[1];
                    const streamUrl = raw.startsWith('http')
                      ? raw
                      : `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;

                    if (!streams.some((s) => s.url === streamUrl)) {
                      streams.push({
                        id: `anivexa-${target.audio.toLowerCase()}-${idx}-${Date.now()}`,
                        pluginId: 'com.community.anivexa',
                        pluginName: 'Anivexa Anime Engine Pro',
                        name: `Anivexa ${srv.server || 'Primary'} (${target.audio} 1080p)`,
                        server: `Anivexa CDN [${target.audio}]`,
                        url: streamUrl,
                        quality: '1080p',
                        format: 'hls',
                        isM3U8: true,
                        headers: { Referer: `${origin}/` },
                      });
                    }
                  }
                }
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[Anivexa Mirror 1] Notice:', err);
    }

    return streams;
  },

  // ==========================================
  // 5. Universal Stream Query Handler
  // ==========================================
  async getStreams(query) {
    const { tmdbId, imdbId, title, season = 1, episode = 1, sourceUrl } = query;

    // Fast-path: Direct click from catalog
    if (sourceUrl) {
      const direct = await this.getSourceStreams(sourceUrl, String(episode));
      if (direct && direct.length > 0) return direct;
    }

    let anilistId = query.anilistId;

    // Fast-path: ID offset or lookup
    if (!anilistId && sourceUrl) {
      anilistId = extractId(sourceUrl);
    }

    // Lookup via AniList title search if needed
    if (!anilistId && title) {
      try {
        const searchResults = await this.search(title);
        if (searchResults.length > 0) {
          anilistId = extractId(searchResults[0].id);
        }
      } catch {}
    }

    if (anilistId) {
      return await this.getSourceStreams(`anilist-${anilistId}`, String(episode));
    }

    return [];
  },
};
