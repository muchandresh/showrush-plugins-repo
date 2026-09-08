/**
 * HiAnime (Zoro / AniWatch) Plugin for Showrush
 * Powered by ryanwtf7/hianime-api with separated SUB & DUB server selection,
 * multi-quality HLS streams, AniList simulcast catalogs, and auto-failover mirrors.
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
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
}

async function queryKitsu(endpoint) {
  try {
    const res = await fetch(`https://kitsu.io/api/edge/${endpoint}`, {
      headers: { Accept: 'application/vnd.api+json', 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function cleanHtml(html) {
  return html ? html.replace(/<[^>]*>?/gm, '').trim() : '';
}

function extractId(rawId) {
  if (!rawId) return null;
  const str = String(rawId).replace(/^anilist-/, '').replace(/^hianime-/, '');
  const num = parseInt(str, 10);
  return isNaN(num) ? str : num;
}

return {
  id: 'com.community.hianime',
  name: 'HiAnime (Zoro / AniWatch)',
  version: '1.0.0',
  author: 'Showrush Community',
  description:
    'HiAnime / AniWatch / Zoro scraper powered by ryanwtf7/hianime-api with discrete SUB & DUB server selection, HD-1 & MegaCloud mirrors, and AniList simulcast catalogs.',
  category: 'pro_plugin',
  types: ['anime'],
  languages: ['ja', 'en', 'all'],

  // ==========================================
  // 1. Live Catalog Feeds (HiAnime / AniList)
  // ==========================================
  async getCatalogFeeds(page = 1) {
    const apiBase = (this.settings?.apiUrl || (typeof Showrush !== 'undefined' && Showrush.settings?.hianimeApiUrl) || '').replace(/\/+$/, '');

    // 1. Try native HiAnime API if available
    if (apiBase) {
      try {
        const homeRes = await Showrush.http.get(`${apiBase}/api/v2/hianime/home`, {
          headers: { Accept: 'application/json' },
        });

        if (homeRes.ok && homeRes.data) {
          const json = typeof homeRes.data === 'string' ? JSON.parse(homeRes.data) : homeRes.data;
          const feeds = [];

          if (json?.data?.spotlightAnimes?.length > 0) {
            feeds.push({
              id: 'hianime-spotlight',
              title: '🔥 Spotlight & Featured (HiAnime)',
              items: json.data.spotlightAnimes.map((a) => ({
                id: `hianime-${a.id}`,
                title: a.name || 'Anime',
                poster: a.poster,
                backdrop: a.poster,
                type: a.type === 'Movie' ? 'movie' : 'anime',
                qualityBadge: a.episodes?.dub ? 'SUB / DUB' : 'SUB',
                overview: a.description || '',
                sourceUrl: `hianime-${a.id}`,
              })),
            });
          }

          if (json?.data?.trendingAnimes?.length > 0) {
            feeds.push({
              id: 'hianime-trending',
              title: '📈 Trending Anime (HiAnime)',
              items: json.data.trendingAnimes.map((a) => ({
                id: `hianime-${a.id}`,
                title: a.name || 'Anime',
                poster: a.poster,
                type: 'anime',
                qualityBadge: a.episodes?.dub ? 'SUB / DUB' : 'SUB',
                sourceUrl: `hianime-${a.id}`,
              })),
            });
          }

          if (json?.data?.topAiringAnimes?.length > 0) {
            feeds.push({
              id: 'hianime-airing',
              title: '📅 Top Airing Simulcasts (HiAnime)',
              items: json.data.topAiringAnimes.map((a) => ({
                id: `hianime-${a.id}`,
                title: a.name || 'Anime',
                poster: a.poster,
                type: 'anime',
                qualityBadge: `EP ${a.episodes?.sub || 1}`,
                sourceUrl: `hianime-${a.id}`,
              })),
            });
          }

          if (feeds.length > 0) return feeds;
        }
      } catch (err) {
        console.warn('[HiAnime API home failed, falling back to AniList]', err);
      }
    }

    // 2. Resilient AniList GraphQL fallback feeds
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
        }
      `;

      const data = await queryAniList(gqlQuery, { page });
      if (!data) {
        const kitsuData = await queryKitsu('trending/anime');
        if (kitsuData?.data?.length > 0) {
          const items = kitsuData.data.map((k) => {
            const attr = k.attributes || {};
            const title = attr.canonicalTitle || attr.titles?.en || attr.titles?.en_jp || 'Anime';
            return {
              id: `kitsu-${k.id}`,
              title,
              poster: attr.posterImage?.large || attr.posterImage?.original || '',
              backdrop: attr.coverImage?.large || attr.coverImage?.original || '',
              type: attr.subtype === 'movie' ? 'movie' : 'anime',
              qualityBadge: 'SUB / DUB',
              rating: attr.averageRating ? parseFloat(attr.averageRating) / 10 : 8.0,
              overview: cleanHtml(attr.synopsis),
              sourceUrl: `kitsu-${k.id}`,
              episodes: attr.episodeCount || 12,
            };
          });
          return [{ id: 'hianime-trending', title: '🔥 HiAnime Trending Anime', items }];
        }
        return [];
      }

      const mapMediaItem = (m, customBadge) => {
        const title = m.title?.english || m.title?.romaji || 'Anime';
        const isMovie = m.format === 'MOVIE';
        return {
          id: `anilist-${m.id}`,
          title,
          poster: m.coverImage?.extraLarge || m.coverImage?.large,
          backdrop: m.bannerImage || m.coverImage?.extraLarge,
          type: isMovie ? 'movie' : 'anime',
          qualityBadge: customBadge || 'SUB / DUB',
          year: m.seasonYear ? String(m.seasonYear) : undefined,
          rating: m.averageScore ? m.averageScore / 10 : 8.5,
          overview: cleanHtml(m.description),
          sourceUrl: `anilist-${m.id}`,
          episodes: m.episodes || (isMovie ? 1 : 12),
        };
      };

      const feeds = [];
      if (data.trending?.media?.length > 0) {
        feeds.push({
          id: 'hianime-trending',
          title: '🔥 HiAnime Trending & Simulcasts',
          items: data.trending.media.map((m) => mapMediaItem(m, 'SUB / DUB')),
        });
      }
      if (data.airing?.media?.length > 0) {
        feeds.push({
          id: 'hianime-airing',
          title: '📅 HiAnime Airing Today',
          items: data.airing.media.map((m) => {
            const badge = m.nextAiringEpisode?.episode ? `EP ${m.nextAiringEpisode.episode}` : 'AIRING';
            return mapMediaItem(m, badge);
          }),
        });
      }
      if (data.topRated?.media?.length > 0) {
        feeds.push({
          id: 'hianime-top-rated',
          title: '👑 HiAnime All-Time Classics',
          items: data.topRated.media.map((m) => mapMediaItem(m, '1080p')),
        });
      }
      return feeds;
    } catch {
      return [];
    }
  },

  // ==========================================
  // 2. Search Handler
  // ==========================================
  async search(query) {
    if (!query || !query.trim()) return [];
    const apiBase = (this.settings?.apiUrl || (typeof Showrush !== 'undefined' && Showrush.settings?.hianimeApiUrl) || '').replace(/\/+$/, '');

    if (apiBase) {
      try {
        const sRes = await Showrush.http.get(`${apiBase}/api/v2/hianime/search?q=${encodeURIComponent(query.trim())}`, {
          headers: { Accept: 'application/json' },
        });
        if (sRes.ok && sRes.data) {
          const json = typeof sRes.data === 'string' ? JSON.parse(sRes.data) : sRes.data;
          const animes = json?.data?.animes || [];
          if (animes.length > 0) {
            return animes.map((a) => ({
              id: `hianime-${a.id}`,
              title: a.name || 'Anime',
              poster: a.poster,
              type: a.type === 'Movie' ? 'movie' : 'anime',
              qualityBadge: a.episodes?.dub ? 'SUB / DUB' : 'SUB',
              url: `hianime-${a.id}`,
            }));
          }
        }
      } catch {}
    }

    try {
      const gqlQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 20) {
            media(search: $search, type: ANIME, isAdult: false) {
              id
              title { romaji english }
              coverImage { extraLarge large }
              format
              seasonYear
              averageScore
              description
            }
          }
        }
      `;
      const data = await queryAniList(gqlQuery, { search: query.trim() });
      if (!data) {
        const kSearch = await queryKitsu(`anime?filter[text]=${encodeURIComponent(query.trim())}&page[limit]=20`);
        if (kSearch?.data?.length > 0) {
          return kSearch.data.map((k) => {
            const attr = k.attributes || {};
            const title = attr.canonicalTitle || attr.titles?.en || attr.titles?.en_jp || 'Anime';
            return {
              id: `kitsu-${k.id}`,
              title,
              poster: attr.posterImage?.large || attr.posterImage?.original || '',
              type: attr.subtype === 'movie' ? 'movie' : 'anime',
              year: attr.startDate ? attr.startDate.split('-')[0] : undefined,
              rating: attr.averageRating ? parseFloat(attr.averageRating) / 10 : 8.5,
              overview: cleanHtml(attr.synopsis),
              url: `kitsu-${k.id}`,
            };
          });
        }
        return [];
      }
      const list = data?.Page?.media || [];
      return list.map((m) => ({
        id: `anilist-${m.id}`,
        title: m.title?.english || m.title?.romaji || 'Anime',
        poster: m.coverImage?.extraLarge || m.coverImage?.large,
        type: m.format === 'MOVIE' ? 'movie' : 'anime',
        year: m.seasonYear ? String(m.seasonYear) : undefined,
        rating: m.averageScore ? m.averageScore / 10 : 8.5,
        overview: cleanHtml(m.description),
        url: `anilist-${m.id}`,
      }));
    } catch {
      return [];
    }
  },

  // ==========================================
  // 3. Anime Details & Episodes
  // ==========================================
  async getSourceDetails(sourceId) {
    if (String(sourceId).startsWith('kitsu-')) {
      const kid = String(sourceId).replace('kitsu-', '');
      try {
        const kData = await queryKitsu(`anime/${kid}`);
        const attr = kData?.data?.attributes;
        if (attr) {
          const title = attr.canonicalTitle || attr.titles?.en || 'Anime';
          const isMovie = attr.subtype === 'movie';
          const epCount = attr.episodeCount || (isMovie ? 1 : 12);
          return {
            id: `kitsu-${kid}`,
            title,
            poster: attr.posterImage?.large || attr.posterImage?.original,
            backdrop: attr.coverImage?.large || attr.coverImage?.original || attr.posterImage?.large,
            type: isMovie ? 'movie' : 'anime',
            overview: cleanHtml(attr.synopsis),
            year: attr.startDate ? attr.startDate.split('-')[0] : '',
            rating: attr.averageRating ? parseFloat(attr.averageRating) / 10 : 8.0,
            episodes: Array.from({ length: epCount }, (_, i) => ({
              id: String(i + 1),
              episodeNumber: i + 1,
              seasonNumber: 1,
              title: `Episode ${i + 1}`,
              overview: `Episode ${i + 1} of ${title}`,
            })),
          };
        }
      } catch {}
    }

    const raw = extractId(sourceId);
    if (!raw) return null;

    const apiBase = (this.settings?.apiUrl || (typeof Showrush !== 'undefined' && Showrush.settings?.hianimeApiUrl) || '').replace(/\/+$/, '');
    if (apiBase && typeof raw === 'string' && !String(raw).match(/^\d+$/)) {
      try {
        const epRes = await Showrush.http.get(`${apiBase}/api/v2/hianime/anime/${raw}/episodes`, {
          headers: { Accept: 'application/json' },
        });
        if (epRes.ok && epRes.data) {
          const json = typeof epRes.data === 'string' ? JSON.parse(epRes.data) : epRes.data;
          const epList = json?.data?.episodes || [];
          if (epList.length > 0) {
            return {
              id: `hianime-${raw}`,
              title: json.data?.animeName || 'Anime',
              type: 'anime',
              episodes: epList.map((e) => ({
                id: e.episodeId || String(e.number),
                episodeNumber: e.number,
                seasonNumber: 1,
                title: e.title || `Episode ${e.number}`,
              })),
            };
          }
        }
      } catch {}
    }

    const numId = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/\D/g, ''), 10);
    if (!numId) return null;

    try {
      const gqlQuery = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title { romaji english }
            bannerImage
            coverImage { extraLarge large }
            description
            format
            episodes
            averageScore
            genres
            seasonYear
          }
        }
      `;
      const data = await queryAniList(gqlQuery, { id: numId });
      const media = data?.Media;
      if (!media) return null;

      const title = media.title?.english || media.title?.romaji || 'Anime';
      const isMovie = media.format === 'MOVIE';
      const epCount = media.episodes || (isMovie ? 1 : 12);

      const episodes = Array.from({ length: epCount }, (_, idx) => {
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
        year: String(media.seasonYear || ''),
        rating: media.averageScore ? media.averageScore / 10 : 8.5,
        genres: media.genres || [],
        episodes,
      };
    } catch {
      return null;
    }
  },

  // ==========================================
  // 4. Multi-Server Sub / Dub Stream Extraction
  // ==========================================
  async getSourceStreams(sourceId, episodeId = '1') {
    const epNum = parseInt(String(episodeId), 10) || 1;

    if (String(sourceId).startsWith('kitsu-')) {
      const kid = String(sourceId).replace('kitsu-', '');
      try {
        const kData = await queryKitsu(`anime/${kid}`);
        const title = kData?.data?.attributes?.canonicalTitle || kData?.data?.attributes?.titles?.en;
        if (title) {
          return this.getStreams({ title, episode: epNum });
        }
      } catch {}
    }

    const raw = extractId(sourceId);
    const streams = [];

    const apiBase = (this.settings?.apiUrl || (typeof Showrush !== 'undefined' && Showrush.settings?.hianimeApiUrl) || '').replace(/\/+$/, '');

    // Path A: HiAnime API direct endpoint
    if (apiBase) {
      try {
        const targetEpId = String(episodeId).includes('?') ? episodeId : `${raw}?ep=${epNum}`;
        const srvRes = await Showrush.http.get(`${apiBase}/api/v2/hianime/episode/servers?animeEpisodeId=${encodeURIComponent(targetEpId)}`, {
          headers: { Accept: 'application/json' },
        });

        if (srvRes.ok && srvRes.data) {
          const srvJson = typeof srvRes.data === 'string' ? JSON.parse(srvRes.data) : srvRes.data;
          for (const cat of ['sub', 'dub']) {
            const catList = srvJson?.data?.[cat] || [];
            for (const srv of catList) {
              try {
                const sUrl = `${apiBase}/api/v2/hianime/episode/sources?animeEpisodeId=${encodeURIComponent(targetEpId)}&server=${srv.serverName}&category=${cat}`;
                const srcRes = await Showrush.http.get(sUrl, { headers: { Accept: 'application/json' } });
                if (srcRes.ok && srcRes.data) {
                  const srcJson = typeof srcRes.data === 'string' ? JSON.parse(srcRes.data) : srcRes.data;
                  for (const [idx, item] of (srcJson?.data?.sources || []).entries()) {
                    if (item.url && !streams.some((x) => x.url === item.url)) {
                      const isDub = cat === 'dub';
                      streams.push({
                        id: `hianime-${cat}-${srv.serverName}-${idx}-${Date.now()}`,
                        pluginId: 'com.community.hianime',
                        pluginName: 'HiAnime (Zoro)',
                        name: `HiAnime ${srv.serverName.toUpperCase()} [${cat.toUpperCase()}]`,
                        server: `HiAnime CDN [${cat.toUpperCase()}]`,
                        url: item.url,
                        quality: '1080p',
                        format: item.isM3U8 ? 'hls' : 'mp4',
                        isM3U8: Boolean(item.isM3U8),
                        headers: srcJson?.data?.headers || {},
                        audio: isDub ? 'dub' : 'sub',
                        isDub,
                        subtitles: (srcJson?.data?.tracks || []).map((t) => ({
                          label: t.label || 'English',
                          lang: t.lang || 'en',
                          url: t.file || t.url || '',
                        })),
                      });
                    }
                  }
                }
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn('[HiAnime API direct stream notice]', err);
      }
    }

    // Path B: High-Speed Sub/Dub Mirror Fallback
    const numId = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/\D/g, ''), 10);
    if (numId) {
      try {
        const serversRes = await Showrush.http.get(`${ANIMEAPPS_BASE}/api2.php?epid=${numId}`, {
          headers: {
            Accept: 'application/json',
            Referer: 'https://animeapps.top/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          },
        });

        const srvData = typeof serversRes.data === 'string' ? JSON.parse(serversRes.data) : serversRes.data;
        if (serversRes.ok && Array.isArray(srvData)) {
          const epTargets = [];
          const epPad = String(epNum).padStart(2, '0');

          for (const group of srvData) {
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
                {
                  headers: {
                    Accept: 'application/json',
                    Referer: 'https://animeapps.top/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                  },
                }
              );

              const linksData = typeof linksRes.data === 'string' ? JSON.parse(linksRes.data) : linksRes.data;
              if (linksRes.ok && Array.isArray(linksData)) {
                for (const [idx, srv] of linksData.entries()) {
                  if (!srv.link) continue;
                  const origin = new URL(srv.link).origin;
                  const htmlRes = await Showrush.http.get(srv.link, {
                    headers: {
                      Referer: `${origin}/`,
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                    },
                  });

                  if (htmlRes.ok && typeof htmlRes.data === 'string') {
                    const m = htmlRes.data.match(/videoUrl\s*:\s*["\x27]([^"\x27]+)["\x27]/);
                    if (m) {
                      const rawUrl = m[1].replace(/\\\//g, '/');
                      const streamUrl = rawUrl.startsWith('http')
                        ? rawUrl
                        : `${origin}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

                      if (!streams.some((s) => s.url === streamUrl)) {
                        const isDub = target.audio.toLowerCase() === 'dub';
                        streams.push({
                          id: `hianime-${target.audio.toLowerCase()}-${idx}-${Date.now()}`,
                          pluginId: 'com.community.hianime',
                          pluginName: 'HiAnime (Zoro)',
                          name: `HiAnime ${srv.server || 'HD-1'} [${target.audio.toUpperCase()}]`,
                          server: `HiAnime CDN [${target.audio.toUpperCase()}]`,
                          url: streamUrl,
                          quality: '1080p',
                          format: 'hls',
                          isM3U8: true,
                          headers: { Referer: `${origin}/` },
                          audio: isDub ? 'dub' : 'sub',
                          isDub,
                        });
                      }
                    }
                  }
                }
              }
            } catch {}
          }
        }
      } catch {}
    }

    return streams;
  },

  // ==========================================
  // 5. Universal Stream Query Handler
  // ==========================================
  async getStreams(query) {
    const { tmdbId, imdbId, title, season = 1, episode = 1, sourceUrl } = query;

    if (sourceUrl) {
      const direct = await this.getSourceStreams(sourceUrl, String(episode));
      if (direct && direct.length > 0) return direct;
    }

    let anilistId = query.anilistId;
    if (!anilistId && sourceUrl) anilistId = extractId(sourceUrl);

    if (!anilistId && title) {
      try {
        const searchResults = await this.search(title);
        if (searchResults.length > 0) {
          anilistId = extractId(searchResults[0].id);
        }
      } catch {}
    }

    let streams = [];
    if (anilistId) {
      try {
        streams = await this.getSourceStreams(`anilist-${anilistId}`, String(episode));
      } catch {}
    }

    // Guarantee English Dub / Multi-Audio fallback if primary mirror only returned Japanese Sub
    const hasDub = streams.some((s) => s.isDub);
    if (!hasDub && Showrush?.extractors?.vidsrc && (tmdbId || imdbId || title)) {
      try {
        const vStreams = await Showrush.extractors.vidsrc({
          tmdbId,
          imdbId,
          title,
          type: 'tv',
          season: Number(season) || 1,
          episode: Number(episode) || 1,
        });
        if (Array.isArray(vStreams) && vStreams.length > 0) {
          for (const [idx, s] of vStreams.entries()) {
            streams.push({
              ...s,
              id: `hianime-dub-${idx + 1}-${Date.now()}`,
              pluginId: 'com.community.hianime',
              pluginName: 'HiAnime (Zoro)',
              name: `HiAnime Master [DUB] • 1080p Server ${idx + 1}`,
              server: `HiAnime CDN [DUB] ${idx + 1}`,
              audio: 'dub',
              isDub: true,
            });
          }
        }
      } catch {}
    }

    return streams;
  },
};
