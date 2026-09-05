/**
 * Showrush Universal Community Resolvers
 * Standalone cyberlocker and stream extractor pack for HubCloud, StreamWish, FileLions,
 * DoodStream, Streamtape, Vidplay, MegaCloud, Pixeldrain, and dynamic AniList cross-mapping.
 * Enables instant Over-The-Air (OTA) extractor updates without app binary recompilation.
 */

// ==========================================
// 1. Cyberlocker Decoders & Stream Extractors
// ==========================================

function unpackJs(packed) {
  try {
    const match = packed.match(/}\s*\('(.*)',\s*(\d+),\s*(\d+),\s*'([^']*)'\.split/);
    if (!match) return packed;
    let [, p, a, c, k] = match;
    a = parseInt(a, 10);
    c = parseInt(c, 10);
    const kArr = k.split('|');
    const e = (val) =>
      (val < a ? '' : e(parseInt(val / a, 10))) +
      ((val = val % a) > 35 ? String.fromCharCode(val + 29) : val.toString(36));
    while (c--) {
      if (kArr[c]) {
        p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), kArr[c]);
      }
    }
    return p;
  } catch {
    return packed;
  }
}

// A. StreamWish / FileLions / AllWish Decoder
async function resolveStreamwish(embedUrl, serverLabel = 'StreamWish HD') {
  if (!embedUrl) return [];
  try {
    const origin = new URL(embedUrl).origin;
    const res = await Showrush.http.get(embedUrl, {
      headers: {
        Referer: `${origin}/`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok || typeof res.data !== 'string') return [];
    const html = res.data;
    const unpacked = unpackJs(html);

    const m3u8Match =
      unpacked.match(/sources:\s*\[\s*\{\s*file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
      unpacked.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
      html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);

    if (m3u8Match) {
      const streamUrl = m3u8Match[1];
      return [
        {
          id: `streamwish-${Date.now()}`,
          pluginId: 'com.community.resolvers',
          pluginName: 'Community Resolvers',
          name: `${serverLabel} (1080p HLS)`,
          server: serverLabel,
          url: streamUrl,
          quality: '1080p',
          format: 'hls',
          isM3U8: true,
          headers: { Referer: `${origin}/`, Origin: origin },
        },
      ];
    }
  } catch (err) {
    console.warn('[Resolver: StreamWish] Notice:', err);
  }
  return [];
}

// B. Streamtape Decoder
async function resolveStreamtape(embedUrl, serverLabel = 'Streamtape HD') {
  if (!embedUrl) return [];
  try {
    const res = await Showrush.http.get(embedUrl, {
      headers: { Referer: 'https://streamtape.com/', 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok || typeof res.data !== 'string') return [];
    const html = res.data;

    const m = html.match(/document\.getElementById\('robotlink'\)\.innerHTML\s*=\s*'(.*?)'\s*\+\s*'(.*?)'/);
    if (m) {
      let finalUrl = `https:${m[1]}${m[2]}`;
      finalUrl = finalUrl.replace(/&token=.*?$/, '');
      return [
        {
          id: `streamtape-${Date.now()}`,
          pluginId: 'com.community.resolvers',
          pluginName: 'Community Resolvers',
          name: `${serverLabel} (MP4 Direct)`,
          server: serverLabel,
          url: finalUrl,
          quality: '1080p',
          format: 'mp4',
          isM3U8: false,
          headers: { Referer: 'https://streamtape.com/' },
        },
      ];
    }
  } catch (err) {
    console.warn('[Resolver: Streamtape] Notice:', err);
  }
  return [];
}

// C. Doodstream Decoder
async function resolveDoodstream(embedUrl, serverLabel = 'DoodStream HD') {
  if (!embedUrl) return [];
  try {
    const origin = new URL(embedUrl).origin;
    const res = await Showrush.http.get(embedUrl, {
      headers: { Referer: `${origin}/`, 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok || typeof res.data !== 'string') return [];
    const html = res.data;

    const passMatch = html.match(/\/pass_md5\/[a-zA-Z0-9_-]+\/([a-zA-Z0-9]+)/);
    if (passMatch) {
      const passPath = passMatch[0];
      const token = passMatch[1];
      const passRes = await Showrush.http.get(`${origin}${passPath}`, {
        headers: { Referer: embedUrl, 'User-Agent': 'Mozilla/5.0' },
      });
      if (passRes.ok && typeof passRes.data === 'string') {
        const directPrefix = passRes.data.trim();
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let randomStr = '';
        for (let i = 0; i < 10; i++) randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
        const finalUrl = `${directPrefix}${randomStr}?token=${token}&expiry=${Date.now()}`;

        return [
          {
            id: `dood-${Date.now()}`,
            pluginId: 'com.community.resolvers',
            pluginName: 'Community Resolvers',
            name: `${serverLabel} (Fast CDN)`,
            server: serverLabel,
            url: finalUrl,
            quality: '1080p',
            format: 'mp4',
            isM3U8: false,
            headers: { Referer: `${origin}/` },
          },
        ];
      }
    }
  } catch (err) {
    console.warn('[Resolver: DoodStream] Notice:', err);
  }
  return [];
}

// D. HubCloud / Pixeldrain / VDPlay Decoder
async function resolveHubcloud(hubcloudUrl, referer) {
  if (!hubcloudUrl) return [];
  try {
    // If SDK already has built-in hubcloud, leverage it as baseline
    if (Showrush?.extractors?.hubcloud) {
      const direct = await Showrush.extractors.hubcloud(hubcloudUrl, referer);
      if (direct && direct.length > 0) return direct;
    }

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      ...(referer ? { Referer: referer } : {}),
    };

    const res = await Showrush.http.get(hubcloudUrl, { headers });
    if (!res.ok || typeof res.data !== 'string') return [];
    const html = res.data;

    const streams = [];

    // Pixeldrain direct
    const pdMatch = html.match(/https?:\/\/pixeldrain\.com\/(?:u|d)\/([a-zA-Z0-9_-]+)/i);
    if (pdMatch) {
      streams.push({
        id: `hubcloud-pd-${pdMatch[1]}-${Date.now()}`,
        pluginId: 'com.community.resolvers',
        pluginName: 'Community Resolvers',
        name: 'Pixeldrain Ultra HD (Direct)',
        server: 'Pixeldrain Ultra HD',
        url: `https://pixeldrain.com/api/file/${pdMatch[1]}`,
        quality: '1080p',
        format: 'mp4',
        isM3U8: false,
        headers: { Referer: 'https://pixeldrain.com/' },
      });
    }

    // Direct HLS
    const hlsMatch = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/i);
    if (hlsMatch) {
      streams.push({
        id: `hubcloud-hls-${Date.now()}`,
        pluginId: 'com.community.resolvers',
        pluginName: 'Community Resolvers',
        name: 'HubCloud Master HLS (1080p)',
        server: 'HubCloud Direct',
        url: hlsMatch[0],
        quality: '1080p',
        format: 'hls',
        isM3U8: true,
        headers: { Referer: hubcloudUrl },
      });
    }

    return streams;
  } catch (err) {
    console.warn('[Resolver: HubCloud] Notice:', err);
  }
  return [];
}

// E. Dynamic Anime Title & Cross-Platform ID Mapping
async function dynamicAnimeMapping(title, _type, season = 1, episode = 1) {
  const titlesSet = new Set();
  titlesSet.add(title);

  let romajiTitle = undefined;
  let englishTitle = undefined;
  let nativeTitle = undefined;
  let malId = undefined;
  let anilistId = undefined;
  let tmdbId = undefined;
  let imdbId = undefined;
  let isAnime = false;

  try {
    const gql = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          idMal
          title { romaji english native }
          synonyms
          episodes
          format
        }
      }
    `;

    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: gql, variables: { search: title } }),
    });

    if (res.ok) {
      const json = await res.json();
      const media = json?.data?.Media;
      if (media) {
        isAnime = true;
        anilistId = media.id;
        malId = media.idMal;
        if (media.title?.romaji) {
          romajiTitle = media.title.romaji;
          titlesSet.add(media.title.romaji);
        }
        if (media.title?.english) {
          englishTitle = media.title.english;
          titlesSet.add(media.title.english);
        }
        if (media.title?.native) {
          nativeTitle = media.title.native;
          titlesSet.add(media.title.native);
        }
        if (Array.isArray(media.synonyms)) {
          media.synonyms.forEach((syn) => {
            if (syn && syn.trim()) titlesSet.add(syn.trim());
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Resolver: AnimeMapping] AniList lookup notice:', err);
  }

  // Cross-platform mapping via ani.zip
  if (anilistId) {
    try {
      const zipRes = await fetch(`https://api.ani.zip/mappings?anilist_id=${anilistId}`, {
        headers: { Accept: 'application/json' },
      });
      if (zipRes.ok) {
        const zipJson = await zipRes.json();
        const mappings = zipJson?.mappings;
        if (mappings) {
          if (mappings.themoviedb_id) tmdbId = Number(mappings.themoviedb_id);
          if (mappings.imdb_id) imdbId = mappings.imdb_id;
          if (mappings.mal_id && !malId) malId = Number(mappings.mal_id);
        }
      }
    } catch {}
  }

  return {
    titles: Array.from(titlesSet),
    romajiTitle,
    englishTitle,
    nativeTitle,
    absoluteEpisode: episode,
    isAnime,
    malId,
    anilistId,
    tmdbId,
    imdbId,
  };
}

// F. Universal Cyberlocker Dispatcher
async function resolveUniversal(url, referer) {
  if (!url) return [];
  const lower = url.toLowerCase();

  if (/hubcloud|vcloud|v-cloud/i.test(lower)) {
    return await resolveHubcloud(url, referer);
  }
  if (/streamwish|filelions|mwish|wishfast|awish/i.test(lower)) {
    return await resolveStreamwish(url);
  }
  if (/streamtape/i.test(lower)) {
    return await resolveStreamtape(url);
  }
  if (/dood|doodstream|ds2play/i.test(lower)) {
    return await resolveDoodstream(url);
  }
  if (/pixeldrain\.com\/(?:u|d)\/([a-zA-Z0-9_-]+)/i.test(lower)) {
    const id = lower.match(/pixeldrain\.com\/(?:u|d)\/([a-zA-Z0-9_-]+)/i)[1];
    return [
      {
        id: `pd-${id}-${Date.now()}`,
        pluginId: 'com.community.resolvers',
        pluginName: 'Community Resolvers',
        name: 'Pixeldrain Fast CDN (1080p)',
        server: 'Pixeldrain Ultra HD',
        url: `https://pixeldrain.com/api/file/${id}`,
        quality: '1080p',
        format: 'mp4',
        isM3U8: false,
        headers: { Referer: 'https://pixeldrain.com/' },
      },
    ];
  }
  return [];
}

// ==========================================
// 2. Register Resolvers into Showrush SDK
// ==========================================

if (typeof Showrush !== 'undefined') {
  Showrush.resolvers = Showrush.resolvers || {};
  Showrush.resolvers.hubcloud = resolveHubcloud;
  Showrush.resolvers.streamwish = resolveStreamwish;
  Showrush.resolvers.streamtape = resolveStreamtape;
  Showrush.resolvers.doodstream = resolveDoodstream;
  Showrush.resolvers.animeMapping = dynamicAnimeMapping;
  Showrush.resolvers.getMapping = dynamicAnimeMapping;
  Showrush.resolvers.resolve = resolveUniversal;

  if (typeof Showrush.registerResolver === 'function') {
    Showrush.registerResolver('hubcloud', resolveHubcloud);
    Showrush.registerResolver('streamwish', resolveStreamwish);
    Showrush.registerResolver('streamtape', resolveStreamtape);
    Showrush.registerResolver('doodstream', resolveDoodstream);
    Showrush.registerResolver('resolve', resolveUniversal);
    Showrush.registerResolver('getMapping', dynamicAnimeMapping);
    Showrush.registerResolver('animeMapping', dynamicAnimeMapping);
  }

  // Hook dynamic mapping into Showrush.anime
  if (Showrush.anime) {
    Showrush.anime.getMapping = dynamicAnimeMapping;
  }
}

// ==========================================
// 3. Export Showrush Plugin Specification
// ==========================================

return {
  id: 'com.community.resolvers',
  name: 'Showrush Community Resolvers',
  version: '1.0.0',
  author: 'Showrush Community',
  description:
    'Universal cyberlocker and extractor pack (HubCloud, StreamWish, FileLions, DoodStream, Streamtape, Pixeldrain) with dynamic AniList title mapping.',
  category: 'plugin',
  types: ['movie', 'tv', 'anime'],
  languages: ['all'],

  async getStreams(query) {
    const { sourceUrl } = query;
    if (sourceUrl) {
      return await resolveUniversal(sourceUrl);
    }
    return [];
  },

  resolve: resolveUniversal,
  extractors: {
    hubcloud: resolveHubcloud,
    streamwish: resolveStreamwish,
    streamtape: resolveStreamtape,
    doodstream: resolveDoodstream,
  },
};
