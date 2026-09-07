// VidSrc Direct Stream Extractor Plugin (Standalone WASM/HLS Extension)
// Uses in-memory WebAssembly ChaCha20 decryptor for high-speed master HLS streams

const wasmCache = new Map();
const tokenCache = new Map();

function base64ToUint8Array(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getWasmModule(w, wasmUrl) {
  const cacheKey = String(w);
  if (wasmCache.has(cacheKey)) {
    return wasmCache.get(cacheKey);
  }

  try {
    const res = await http.get(wasmUrl, {
      headers: { 'Referer': 'https://cloudorchestranova.com' },
      responseType: 'arraybuffer',
    });
    if (!res.ok || !res.arrayBuffer) return null;

    const module = await WebAssembly.compile(res.arrayBuffer);
    wasmCache.set(cacheKey, module);
    return module;
  } catch (err) {
    console.error('WASM compile error:', err);
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
    console.error('Stream decryption error:', err);
    return [];
  }
}

async function fetchHostToken(origin) {
  const cached = tokenCache.get(origin);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  try {
    const res = await http.get(`${origin}/generate.php`, {
      headers: { 'Referer': 'https://cloudorchestranova.com' },
    });
    if (!res.ok) return '';

    let token = typeof res.data === 'string' ? res.data.trim() : '';
    try {
      const json = JSON.parse(token);
      if (typeof json === 'string') token = json;
      if (json && typeof json === 'object') {
        token = json.token || json.data || json.string || json.result || '';
      }
    } catch {
      // plain text token
    }

    if (token) {
      tokenCache.set(origin, {
        token,
        expiresAt: Date.now() + 1000 * 60 * 15, // 15 mins cache
      });
      return token;
    }
  } catch (err) {
    console.warn('Failed to fetch host token:', err);
  }
  return '';
}

return {
  id: "com.community.vidsrc-direct",
  name: "VidSrc Direct Stream (WASM/HLS)",
  version: "2.1.0",
  author: "Showrush Community",
  types: ["movie", "tv"],

  async getStreams({ tmdbId, type, season, episode }) {
    if (!tmdbId) return [];

    try {
      const isTv = type === 'tv';
      const endpoint = isTv
        ? `https://data.vidsrcme.ru/api.php?type=tv&tmdb=${tmdbId}&season=${season || 1}&episode=${episode || 1}&stream_urls`
        : `https://data.vidsrcme.ru/api.php?type=movie&tmdb=${tmdbId}&stream_urls`;

      const apiRes = await http.get(endpoint, {
        headers: {
          'Referer': 'https://cloudorchestranova.com',
          'Accept': 'application/json',
        },
      });

      if (!apiRes.ok || !apiRes.data) return [];

      const json = typeof apiRes.data === 'string' ? JSON.parse(apiRes.data) : apiRes.data;
      if (!json?.data?.stream_urls || !json?.vs?.wasm_url) return [];

      const wasm = await getWasmModule(json.vs.w, json.vs.wasm_url);
      if (!wasm) return [];

      const rawUrls = await decryptStreamUrls(wasm, json.data.stream_urls);
      if (rawUrls.length === 0) return [];

      const subtitles = (json.default_subs || []).map((sub) => ({
        label: sub.label || 'English',
        lang: sub.lang || 'en',
        url: sub.file || '',
      })).filter((s) => s.url);

      const sources = [];
      for (let i = 0; i < Math.min(rawUrls.length, 3); i++) {
        const rawUrl = rawUrls[i];
        let origin = 'https://cloudorchestranova.com';
        try {
          origin = new URL(rawUrl).origin;
        } catch {}

        const token = await fetchHostToken(origin);

        const tokenizedUrl = token
          ? rawUrl.includes('__TOKEN__')
            ? rawUrl.replace('__TOKEN__', token)
            : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
          : rawUrl;

        sources.push({
          id: `vidsrc-stream-${i + 1}`,
          name: i === 0 ? 'VidSrc Primary HD' : `VidSrc Mirror ${i + 1}`,
          server: i === 0 ? 'VidSrc Direct HD' : `VidSrc Mirror ${i + 1}`,
          url: tokenizedUrl,
          quality: '1080p',
          format: 'hls',
          headers: {
            'Referer': 'https://cloudorchestranova.com',
            'Origin': 'https://cloudorchestranova.com',
          },
          subtitles,
        });
      }

      return sources;
    } catch (err) {
      console.error('VidSrc plugin extractor failed:', err);
      return [];
    }
  },
};
