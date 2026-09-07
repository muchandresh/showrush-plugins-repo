/**
 * Showrush Plugin DevBench & Testing Server
 * Interactive development server & validation suite for Showrush streaming plugins
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listAllPlugins,
  loadPluginInstance,
  createHttpEngine,
} from './src/dev-sandbox.js';
import { buildRepository } from './src/builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const http = createHttpEngine();

// ==========================================
// 1. Plugin Inventory APIs
// ==========================================
app.get('/api/plugins', (req, res) => {
  try {
    const plugins = listAllPlugins();
    res.json({ ok: true, plugins });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/plugins/:id', (req, res) => {
  try {
    const plugins = listAllPlugins();
    const plugin = plugins.find((p) => p.folder === req.params.id || p.id === req.params.id);
    if (!plugin) return res.status(404).json({ ok: false, error: 'Plugin not found' });
    res.json({ ok: true, plugin });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// 2. Stream Liveness Probe Helper
// ==========================================
async function probeStream(streamUrl, headers = {}) {
  const startTime = Date.now();
  try {
    const probeHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/133.0.0.0 Safari/537.36',
      ...(headers || {}),
    };

    // Range request for fast header inspection without downloading entire media
    const res = await fetch(streamUrl, {
      method: 'GET',
      headers: { ...probeHeaders, Range: 'bytes=0-1024' },
      signal: AbortSignal.timeout(6000),
    });

    const elapsed = Date.now() - startTime;
    const contentType = res.headers.get('content-type') || '';
    const contentLength = res.headers.get('content-length') || '';

    return {
      live: res.ok || res.status === 206,
      status: res.status,
      contentType,
      contentLength,
      latencyMs: elapsed,
      isHls: contentType.includes('mpegurl') || streamUrl.includes('.m3u8'),
      isMp4: contentType.includes('mp4') || streamUrl.includes('.mp4'),
    };
  } catch (err) {
    return {
      live: false,
      status: 0,
      error: err.message,
      latencyMs: Date.now() - startTime,
    };
  }
}

app.post('/api/test/probe', async (req, res) => {
  const { url, headers } = req.body;
  if (!url) return res.status(400).json({ ok: false, error: 'URL required' });
  const result = await probeStream(url, headers);
  res.json({ ok: true, probe: result });
});

// ==========================================
// 3. Catalog Feeds Test API
// ==========================================
app.post('/api/test/catalog', async (req, res) => {
  const { pluginId, page = 1, settings = {} } = req.body;
  const startTime = Date.now();

  try {
    const { instance, manifest } = loadPluginInstance(pluginId, settings);
    if (typeof instance.getCatalogFeeds !== 'function') {
      return res.json({
        ok: false,
        error: `Plugin "${instance.name || pluginId}" does not implement getCatalogFeeds().`,
        isCatalogProvider: false,
      });
    }

    const feeds = await instance.getCatalogFeeds(Number(page) || 1);
    const elapsed = Date.now() - startTime;

    let totalItems = 0;
    const feedSummaries = (feeds || []).map((f) => {
      const itemsCount = f.items ? f.items.length : 0;
      totalItems += itemsCount;
      return {
        id: f.id,
        title: f.title,
        itemCount: itemsCount,
        sampleItems: (f.items || []).slice(0, 8),
      };
    });

    res.json({
      ok: true,
      pluginName: instance.name || manifest?.name,
      executionMs: elapsed,
      totalFeeds: feeds.length,
      totalItems,
      feeds: feedSummaries,
    });
  } catch (err) {
    res.json({
      ok: false,
      error: err.message,
      executionMs: Date.now() - startTime,
    });
  }
});

// ==========================================
// 4. Search Test API
// ==========================================
app.post('/api/test/search', async (req, res) => {
  const { pluginId, query, settings = {} } = req.body;
  const startTime = Date.now();

  try {
    const { instance, manifest } = loadPluginInstance(pluginId, settings);
    if (typeof instance.search !== 'function') {
      return res.json({
        ok: false,
        error: `Plugin "${instance.name || pluginId}" does not implement search().`,
        hasSearch: false,
      });
    }

    const results = await instance.search(query || 'Deadpool');
    const elapsed = Date.now() - startTime;

    res.json({
      ok: true,
      pluginName: instance.name || manifest?.name,
      query,
      executionMs: elapsed,
      count: Array.isArray(results) ? results.length : 0,
      results: Array.isArray(results) ? results : [],
    });
  } catch (err) {
    res.json({
      ok: false,
      error: err.message,
      executionMs: Date.now() - startTime,
    });
  }
});

// ==========================================
// 5. Video Sources Finder Test API
// ==========================================
app.post('/api/test/streams', async (req, res) => {
  const { pluginId, query = {}, settings = {}, probe = true } = req.body;
  const startTime = Date.now();

  try {
    const { instance, manifest } = loadPluginInstance(pluginId, settings);

    const hasGetStreams = typeof instance.getStreams === 'function';
    const hasGetSourceStreams = typeof instance.getSourceStreams === 'function';

    if (!hasGetStreams && !hasGetSourceStreams) {
      return res.json({
        ok: false,
        error: `Plugin "${instance.name || pluginId}" does not implement getStreams() or getSourceStreams().`,
      });
    }

    let streams = [];

    if (query.sourceUrl && hasGetSourceStreams) {
      streams = await instance.getSourceStreams(query.sourceUrl, String(query.episode || 1));
    }

    if ((!streams || streams.length === 0) && hasGetStreams) {
      streams = await instance.getStreams({
        tmdbId: query.tmdbId ? Number(query.tmdbId) : 550,
        imdbId: query.imdbId,
        title: query.title || 'Fight Club',
        type: query.type || 'movie',
        season: Number(query.season) || 1,
        episode: Number(query.episode) || 1,
        isAnime: Boolean(query.isAnime),
        sourceUrl: query.sourceUrl,
      });
    }

    const elapsed = Date.now() - startTime;
    const streamList = Array.isArray(streams) ? streams : [];

    // Probe first 4 streams for liveness if requested
    const probedStreams = [];
    for (const [idx, s] of streamList.entries()) {
      if (probe && idx < 4 && s.url && !s.url.startsWith('magnet:')) {
        const p = await probeStream(s.url, s.headers);
        probedStreams.push({ ...s, probe: p });
      } else {
        probedStreams.push({ ...s, probe: null });
      }
    }

    res.json({
      ok: true,
      pluginName: instance.name || manifest?.name,
      executionMs: elapsed,
      count: streamList.length,
      streams: probedStreams,
    });
  } catch (err) {
    res.json({
      ok: false,
      error: err.message,
      executionMs: Date.now() - startTime,
    });
  }
});

// ==========================================
// 6. Full Usability Suite Check API
// ==========================================
app.post('/api/test/full', async (req, res) => {
  const { pluginId, query = {}, settings = {} } = req.body;
  const suiteStart = Date.now();

  const report = {
    pluginId,
    score: 100,
    status: 'PASS',
    checks: [],
    details: {},
  };

  try {
    const { instance, manifest } = loadPluginInstance(pluginId, settings);
    report.pluginName = instance.name || manifest?.name || pluginId;
    report.version = instance.version || manifest?.version || '1.0.0';
    report.category = manifest?.category || 'plugin';

    // Check 1: Interface & Metadata
    const hasName = Boolean(instance.name);
    const hasTypes = Array.isArray(instance.types) && instance.types.length > 0;
    report.checks.push({
      name: 'Interface & Metadata Contract',
      passed: hasName && hasTypes,
      details: `ID: ${instance.id || manifest?.id}, Types: [${(instance.types || []).join(', ')}]`,
    });
    if (!hasName || !hasTypes) report.score -= 20;

    // Check 2: Catalog Check (if Pro / Catalog)
    if (typeof instance.getCatalogFeeds === 'function') {
      try {
        const catStart = Date.now();
        const feeds = await instance.getCatalogFeeds(1);
        const catTime = Date.now() - catStart;
        const totalItems = (feeds || []).reduce((acc, f) => acc + (f.items?.length || 0), 0);
        const pass = Array.isArray(feeds) && feeds.length > 0 && totalItems > 0;
        report.checks.push({
          name: 'Catalog Feeds (Source-Offered Feeds)',
          passed: pass,
          details: `${feeds?.length || 0} feeds, ${totalItems} total items (${catTime}ms)`,
        });
        report.details.catalog = { feedsCount: feeds?.length, totalItems, latencyMs: catTime };
        if (!pass) report.score -= 25;
      } catch (catErr) {
        report.checks.push({
          name: 'Catalog Feeds',
          passed: false,
          error: catErr.message,
        });
        report.score -= 25;
      }
    }

    // Check 3: Search Capability (if defined)
    if (typeof instance.search === 'function') {
      try {
        const sStart = Date.now();
        const testTerm = query.title || 'Deadpool';
        const searchHits = await instance.search(testTerm);
        const sTime = Date.now() - sStart;
        const pass = Array.isArray(searchHits) && searchHits.length > 0;
        report.checks.push({
          name: `Search Capability ("${testTerm}")`,
          passed: pass,
          details: `${searchHits?.length || 0} results found (${sTime}ms)`,
        });
        report.details.search = { count: searchHits?.length, latencyMs: sTime };
        if (!pass) report.score -= 15;
      } catch (sErr) {
        report.checks.push({
          name: 'Search Capability',
          passed: false,
          error: sErr.message,
        });
        report.score -= 15;
      }
    }

    // Check 4: Stream Resolution & Video Sources Finder
    const hasStreams = typeof instance.getStreams === 'function' || typeof instance.getSourceStreams === 'function';
    if (hasStreams) {
      try {
        const stStart = Date.now();
        const sampleQuery = {
          tmdbId: query.tmdbId ? Number(query.tmdbId) : 550,
          title: query.title || 'Fight Club',
          type: query.type || 'movie',
          season: Number(query.season) || 1,
          episode: Number(query.episode) || 1,
          isAnime: Boolean(query.isAnime),
        };

        const streams = await instance.getStreams(sampleQuery);
        const stTime = Date.now() - stStart;
        const streamList = Array.isArray(streams) ? streams : [];

        let liveCount = 0;
        const probes = [];
        for (const [idx, s] of streamList.slice(0, 3).entries()) {
          if (s.url && !s.url.startsWith('magnet:')) {
            const pr = await probeStream(s.url, s.headers);
            if (pr.live) liveCount++;
            probes.push({ server: s.server || s.name, live: pr.live, status: pr.status, type: pr.contentType });
          }
        }

        const pass = streamList.length > 0;
        report.checks.push({
          name: 'Video Sources Finder (getStreams)',
          passed: pass,
          details: `${streamList.length} stream sources resolved (${stTime}ms)`,
        });

        report.checks.push({
          name: 'Stream Playback Liveness (HTTP 200/206)',
          passed: liveCount > 0 || streamList.some((s) => s.url?.startsWith('magnet:')),
          details: `${liveCount} verified live streams (HLS/MP4)`,
        });

        report.details.streams = {
          count: streamList.length,
          liveCount,
          latencyMs: stTime,
          probes,
          firstStream: streamList[0] || null,
        };

        if (!pass) report.score -= 40;
        else if (liveCount === 0 && !streamList.some((s) => s.url?.startsWith('magnet:'))) report.score -= 15;
      } catch (stErr) {
        report.checks.push({
          name: 'Video Sources Finder',
          passed: false,
          error: stErr.message,
        });
        report.score -= 40;
      }
    }

    report.score = Math.max(0, report.score);
    if (report.score >= 85) report.verdict = '✅ PRODUCTION READY - 100% USABLE IN SHOWRUSH';
    else if (report.score >= 50) report.verdict = '⚠️ PARTIAL FUNCTIONALITY - INSPECT WARNINGS';
    else report.verdict = '❌ INCOMPATIBLE - REQUIRES SCRAPER FIX';

    report.totalDurationMs = Date.now() - suiteStart;
    res.json({ ok: true, report });
  } catch (err) {
    res.json({
      ok: false,
      error: err.message,
      report: { ...report, score: 0, verdict: '❌ FATAL LOAD ERROR: ' + err.message },
    });
  }
});

// ==========================================
// 7. Streaming CORS Proxy for In-Browser Testing
// ==========================================
app.get('/proxy/stream', async (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || '';

  if (!targetUrl) return res.status(400).send('Target URL required');

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/133.0.0.0 Safari/537.36',
    };
    if (referer) {
      headers['Referer'] = referer;
      try {
        headers['Origin'] = new URL(referer).origin;
      } catch {}
    }
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const upstream = await fetch(targetUrl, { headers });

    res.status(upstream.status);
    for (const [k, v] of upstream.headers.entries()) {
      if (!['content-encoding', 'content-length'].includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buffer = await upstream.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).send('Proxy streaming error: ' + err.message);
  }
});

// ==========================================
// 8. Packager Build API
// ==========================================
app.post('/api/build', (req, res) => {
  try {
    const result = buildRepository();
    res.json({ ok: true, manifest: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// Start Server
// ==========================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Showrush Plugin DevBench & Testing Suite Live!`);
  console.log(`🔗 Dashboard: http://localhost:${PORT}`);
  console.log(`📦 Plugins:   ${listAllPlugins().length} modular plugins ready`);
  console.log(`======================================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const fallbackPort = Number(PORT) + 1;
    console.log(`Port ${PORT} in use, trying port ${fallbackPort}...`);
    app.listen(fallbackPort, () => {
      console.log(`🚀 DevBench running at http://localhost:${fallbackPort}`);
    });
  } else {
    console.error('Server error:', err);
  }
});
