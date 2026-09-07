/**
 * Showrush Plugin Repository Packager & Builder
 * Compiles modular plugins in src/plugins/ into root standalone files and updates repository.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const pluginsDir = path.resolve(__dirname, 'plugins');

export function buildRepository() {
  console.log('📦 Building Showrush Plugin Repository...\n');

  const pluginDirs = fs.readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const compiledPlugins = [];

  for (const dir of pluginDirs) {
    const manifestPath = path.join(pluginsDir, dir, 'manifest.json');
    const indexPath = path.join(pluginsDir, dir, 'index.js');

    if (!fs.existsSync(manifestPath) || !fs.existsSync(indexPath)) {
      console.warn(`  ⚠️ Skipping ${dir}: missing manifest.json or index.js`);
      continue;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const code = fs.readFileSync(indexPath, 'utf-8');

      const repoEntry = {
        ...manifest,
        scriptUrl: `https://raw.githubusercontent.com/muchandresh/showrush-plugins-repo/refs/heads/master/src/plugins/${dir}/index.js`,
        manifestUrl: `https://raw.githubusercontent.com/muchandresh/showrush-plugins-repo/refs/heads/master/src/plugins/${dir}/manifest.json`,
        pluginDir: `src/plugins/${dir}`,
      };

      compiledPlugins.push(repoEntry);
      console.log(`  ✓ Packaged [${manifest.id}] (${dir}) -> src/plugins/${dir}/index.js`);
    } catch (err) {
      console.error(`  ❌ Failed to package ${dir}:`, err);
    }
  }

  // Update repository.json
  const repoMeta = {
    id: 'com.showrush.community',
    name: 'Showrush Official Community Repository',
    author: 'Showrush Community',
    version: '3.3.0',
    description: 'High-performance direct HLS, Anime, Indian Cinema, and Multi-Language streaming extensions powered by Showrush Extractor SDK.',
    plugins: compiledPlugins,
  };

  const repoJsonPath = path.join(rootDir, 'repository.json');
  fs.writeFileSync(repoJsonPath, JSON.stringify(repoMeta, null, 2));
  console.log(`\n🎉 Successfully packaged ${compiledPlugins.length} plugins into repository.json!`);

  return repoMeta;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildRepository();
}
