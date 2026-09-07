/**
 * Showrush Dev Sandbox Engine
 * Emulates the exact runtime environment of the Showrush app inside Node.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExtractorSuite } from './extractors/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginsDir = path.resolve(__dirname, 'plugins');
const rootDir = path.resolve(__dirname, '..');

// 1. Lightweight DOM Polyfill for HTML Scrapers
function parseAttrs(str) {
  const attrs = {};
  const regex = /(\w+)=["']([^"']*)["']/g;
  let m;
  while ((m = regex.exec(str)) !== null) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return attrs;
}

function createMockElement(tag, attrs = {}, inner = '') {
  return {
    tagName: tag.toUpperCase(),
    getAttribute: (a) => attrs[a.toLowerCase()] || null,
    textContent: (inner || '').replace(/<[^>]+>/g, '').trim(),
    innerHTML: inner || '',
    querySelector: (sel) => {
      const s = sel.toLowerCase();
      if (s.includes('img')) {
        const m = (inner || '').match(/<img\s+([^>]+)>/i);
        if (!m) return null;
        return createMockElement('img', parseAttrs(m[1]), '');
      }
      if (s.includes('a')) {
        const m = (inner || '').match(/<a\s+([^>]*)>([\s\S]*?)<\/a>/i);
        if (!m) return null;
        return createMockElement('a', parseAttrs(m[1]), m[2]);
      }
      return null;
    },
    querySelectorAll: (sel) => {
      const s = sel.toLowerCase();
      const results = [];
      if (s.includes('a')) {
        const linkRegex = /<a\s+([^>]*)>([\s\S]*?)<\/a>/gi;
        let m;
        while ((m = linkRegex.exec(inner)) !== null) {
          results.push(createMockElement('a', parseAttrs(m[1]), m[2]));
        }
      }
      return results;
    },
  };
}

export function parseHtml(html) {
  return {
    querySelector: (sel) => {
      const s = sel.toLowerCase();
      if (s.includes('img')) {
        const m = html.match(/<img\s+([^>]+)>/i);
        return m ? createMockElement('img', parseAttrs(m[1]), '') : null;
      }
      if (s.includes('a')) {
        const m = html.match(/<a\s+([^>]*)>([\s\S]*?)<\/a>/i);
        return m ? createMockElement('a', parseAttrs(m[1]), m[2]) : null;
      }
      return null;
    },
    querySelectorAll: (sel) => {
      const s = sel.toLowerCase();
      const results = [];
      if (s.includes('article')) {
        const artRegex = /<article\s*([^>]*)>([\s\S]*?)<\/article>/gi;
        let m;
        while ((m = artRegex.exec(html)) !== null) {
          results.push(createMockElement('article', parseAttrs(m[1]), m[2]));
        }
      }
      if (results.length === 0 || s.includes('a')) {
        const linkRegex = /<a\s+([^>]*)>([\s\S]*?)<\/a>/gi;
        let m;
        while ((m = linkRegex.exec(html)) !== null) {
          results.push(createMockElement('a', parseAttrs(m[1]), m[2]));
        }
      }
      return results;
    },
  };
}

// 2. HTTP Engine with Referer/Origin Spoofing
export function createHttpEngine() {
  return {
    async get(url, options = {}) {
      try {
        const defaultHeaders = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        };
        const res = await fetch(url, {
          method: options.method || 'GET',
          headers: { ...defaultHeaders, ...(options.headers || {}) },
          body: options.body,
        });

        if (options.responseType === 'arraybuffer') {
          const buffer = await res.arrayBuffer();
          return {
            ok: res.ok,
            status: res.status,
            arrayBuffer: buffer,
            headers: Object.fromEntries(res.headers.entries()),
          };
        }

        const text = await res.text();
        return {
          ok: res.ok,
          status: res.status,
          data: text,
          json: () => {
            try {
              return JSON.parse(text);
            } catch {
              return null;
            }
          },
          headers: Object.fromEntries(res.headers.entries()),
        };
      } catch (err) {
        return {
          ok: false,
          status: 500,
          data: '',
          json: () => null,
          headers: {},
          error: err.message,
        };
      }
    },
    async post(url, body, options = {}) {
      return this.get(url, { ...options, method: 'POST', body });
    },
  };
}

// 3. Dean Edwards Obfuscation Unpacker
export function unpackDeanEdwards(packed) {
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

// 4. Instantiate & Sandbox a Plugin
export function loadPluginInstance(pluginIdOrFolder, settings = {}) {
  let scriptContent = '';
  let manifest = null;

  const folderPath = path.join(pluginsDir, pluginIdOrFolder);
  const rootFilePath = path.join(rootDir, `${pluginIdOrFolder}.js`);

  if (fs.existsSync(path.join(folderPath, 'index.js'))) {
    scriptContent = fs.readFileSync(path.join(folderPath, 'index.js'), 'utf-8');
    if (fs.existsSync(path.join(folderPath, 'manifest.json'))) {
      manifest = JSON.parse(fs.readFileSync(path.join(folderPath, 'manifest.json'), 'utf-8'));
    }
  } else if (fs.existsSync(rootFilePath)) {
    scriptContent = fs.readFileSync(rootFilePath, 'utf-8');
  } else {
    throw new Error(`Plugin not found: ${pluginIdOrFolder}`);
  }

  const http = createHttpEngine();
  const extractors = createExtractorSuite(http);

  const Showrush = {
    http,
    dom: { parse: parseHtml },
    crypto: {
      unpack: unpackDeanEdwards,
      base64Decode: (str) => Buffer.from(str, 'base64').toString('utf-8'),
      base64Encode: (str) => Buffer.from(str).toString('base64'),
    },
    extractors,
    resolvers: extractors,
    settings,
  };

  const factory = new Function('Showrush', 'http', 'settings', `
    let module = { exports: {} };
    let exports = module.exports;
    let window = globalThis;
    ${scriptContent}
    return module.exports.default || module.exports;
  `);

  const instance = factory(Showrush, http, settings);
  if (instance && typeof instance === 'object') {
    instance.settings = settings;
    if (manifest) {
      instance.manifest = manifest;
    }
  }

  return { instance, manifest, http, Showrush };
}

// 5. List all available plugins with metadata
export function listAllPlugins() {
  const dirs = fs.readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const results = [];
  for (const dir of dirs) {
    try {
      const manifestPath = path.join(pluginsDir, dir, 'manifest.json');
      const indexPath = path.join(pluginsDir, dir, 'index.js');
      if (!fs.existsSync(manifestPath)) continue;

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const code = fs.readFileSync(indexPath, 'utf-8');

      results.push({
        folder: dir,
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        author: manifest.author,
        description: manifest.description,
        category: manifest.category || 'plugin',
        types: manifest.types || ['movie', 'tv'],
        languages: manifest.languages || ['all'],
        customBaseUrl: manifest.customBaseUrl,
        settingsSchema: manifest.settingsSchema || [],
        capabilities: {
          hasCatalog: code.includes('getCatalogFeeds'),
          hasSearch: code.includes('search'),
          hasStreams: code.includes('getStreams') || code.includes('getSourceStreams'),
          hasSourceStreams: code.includes('getSourceStreams'),
        },
      });
    } catch {}
  }

  return results;
}
