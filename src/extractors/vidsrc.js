// VidSrc Direct Stream Extractor using WebAssembly ChaCha20
const wasmCache = new Map();
const tokenCache = new Map();

function base64ToUint8Array(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getWasmModule(http, w, wasmUrl) {
  const cacheKey = String(w);
  if (wasmCache.has(cacheKey)) return wasmCache.get(cacheKey);

  try {
    const res = await http.get(wasmUrl, {
      headers: { Referer: 'https://cloudorchestranova.com' },
      responseType: 'arraybuffer',
    });
    if (!res.ok || !res.arrayBuffer) return null;

    const module = await WebAssembly.compile(res.arrayBuffer);
    wasmCache.set(cacheKey, module);
    return module;
  } catch (err) {
    console.warn('[VidSrc Extractor] WASM compile notice:', err);
    return null;
  }
}

async function decryptStreamUrls(wasmModule, encryptedBase64) {
  try {
    const instance = await WebAssembly.instantiate(wasmModule, {});
    const exports = instance.exports;

    const encBytes = base64ToUint8Array(encryptedBase64);
    const ptr = exports.alloc(encBytes.length);
    new Uint8Array(exports.memory.buffer, ptr, encBytes.length).set(encBytes);
    const outLen = exports.decrypt(ptr, encBytes.length);

    const decrypted = new TextDecoder().decode(
      new Uint8Array(exports.memory.buffer, ptr + 12, outLen)
    );

    return decrypted.split('\n').filter(Boolean);
  } catch (err) {
    console.warn('[VidSrc Extractor] Stream decryption notice:', err);
    return [];
  }
}

async function fetchHostToken(http, origin) {
  const cached = tokenCache.get(origin);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  try {
    const res = await http.get(`${origin}/generate.php`, {
      headers: { Referer: 'https://cloudorchestranova.com' },
    });
    if (!res.ok) return '';

    let token = typeof res.data === 'string' ? res.data.trim() : '';
    try {
      const json = JSON.parse(token);
      if (typeof json === 'string') token = json;
      if (json && typeof json === 'object') {
        token = json.token || json.data || json.string || json.result || '';
      }
    } catch {}

    if (token) {
      tokenCache.set(origin, {
        token,
        expiresAt: Date.now() + 1000 * 60 * 15,
      });
      return token;
    }
  } catch (err) {
    console.warn('[VidSrc Extractor] Token notice:', err);
  }
  return '';
}

export async function extractVidSrc(http, query) {
  const { tmdbId, imdbId, type = 'movie', season = 1, episode = 1 } = query;
  if (!tmdbId && !imdbId) return [];

  const isTv = type === 'tv' || type === 'series';
  const streams = [];

  try {
    const endpoint = isTv
      ? `https://data.vidsrcme.ru/api.php?type=tv&tmdb=${tmdbId || ''}&imdb=${imdbId || ''}&season=${season}&episode=${episode}&stream_urls`
      : `https://data.vidsrcme.ru/api.php?type=movie&tmdb=${tmdbId || ''}&imdb=${imdbId || ''}&stream_urls`;

    const apiRes = await http.get(endpoint, {
      headers: {
        Referer: 'https://cloudorchestranova.com',
        Accept: 'application/json',
      },
    });

    if (apiRes.ok && apiRes.data) {
      const json = typeof apiRes.data === 'string' ? JSON.parse(apiRes.data) : apiRes.data;
      if (json?.data?.stream_urls && json?.vs?.wasm_url) {
        const wasm = await getWasmModule(http, json.vs.w, json.vs.wasm_url);
        if (wasm) {
          const rawUrls = await decryptStreamUrls(wasm, json.data.stream_urls);
          const subs = (json.default_subs || [])
            .map((sub) => ({
              label: sub.label || 'English',
              lang: sub.lang || 'en',
              url: sub.file || '',
            }))
            .filter((s) => s.url);

          for (const [idx, rawUrl] of rawUrls.slice(0, 3).entries()) {
            let origin = 'https://cloudorchestranova.com';
            try {
              origin = new URL(rawUrl).origin;
            } catch {}

            const token = await fetchHostToken(http, origin);
            const tokenizedUrl = token
              ? rawUrl.includes('__TOKEN__')
                ? rawUrl.replace('__TOKEN__', token)
                : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
              : rawUrl;

            streams.push({
              id: `vidsrc-${idx + 1}-${Date.now()}`,
              pluginId: 'com.extractors.vidsrc',
              pluginName: 'VidSrc Direct HLS',
              name: idx === 0 ? 'VidSrc Primary (1080p Master HLS)' : `VidSrc CDN Mirror ${idx + 1}`,
              server: idx === 0 ? 'VidSrc Direct HD' : `VidSrc CDN Mirror ${idx + 1}`,
              url: tokenizedUrl,
              quality: '1080p',
              format: 'hls',
              isM3U8: true,
              headers: {
                Referer: 'https://cloudorchestranova.com',
                Origin: 'https://cloudorchestranova.com',
              },
              subtitles: subs,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[extractVidSrc] Notice:', err);
  }

  return streams;
}
