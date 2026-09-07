/**
 * CLI Test Runner for Showrush Plugins
 * Usage: node src/test-cli.js [pluginName]
 */
import { listAllPlugins, loadPluginInstance } from './dev-sandbox.js';

async function runCliTest() {
  const target = process.argv[2] || 'cinestream';
  console.log(`\n🧪 Testing Plugin: "${target}"...\n`);

  const { instance, manifest } = loadPluginInstance(target);
  console.log(`✅ Loaded: ${instance.name || manifest?.name} (${instance.id || manifest?.id})`);

  // 1. Catalog Check
  if (typeof instance.getCatalogFeeds === 'function') {
    const start = Date.now();
    try {
      const feeds = await instance.getCatalogFeeds(1);
      const total = (feeds || []).reduce((acc, f) => acc + (f.items?.length || 0), 0);
      console.log(`📑 Catalog: ${feeds.length} channels, ${total} items (${Date.now() - start}ms)`);
    } catch (err) {
      console.error(`❌ Catalog error:`, err.message);
    }
  }

  // 2. Stream Resolution Check
  if (typeof instance.getStreams === 'function') {
    const start = Date.now();
    try {
      const streams = await instance.getStreams({
        tmdbId: 550,
        title: 'Fight Club',
        type: 'movie',
      });
      console.log(`⚡ Streams: ${streams.length} resolved (${Date.now() - start}ms)`);
      if (streams.length > 0) {
        console.log(`   Sample stream: [${streams[0].server}] ${streams[0].name}`);
        console.log(`   URL: ${streams[0].url}`);
      }
    } catch (err) {
      console.error(`❌ Stream error:`, err.message);
    }
  }

  console.log(`\n🎉 Test completed for "${target}".`);
}

runCliTest().catch(console.error);
