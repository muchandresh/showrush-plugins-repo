import { extractVidSrc } from './vidsrc.js';
import { extractHubcloud } from './hubcloud.js';
import { extractStreamwish } from './streamwish.js';
import { extractStreamtape } from './streamtape.js';
import { extractPixeldrain } from './pixeldrain.js';

export {
  extractVidSrc,
  extractHubcloud,
  extractStreamwish,
  extractStreamtape,
  extractPixeldrain,
};

export function createExtractorSuite(http) {
  return {
    vidsrc: (query) => extractVidSrc(http, query),
    hubcloud: (url, referer) => extractHubcloud(http, url, referer),
    fastdl: (url, referer) => extractHubcloud(http, url, referer),
    streamwish: (url, label) => extractStreamwish(http, url, label),
    streamtape: (url, label) => extractStreamtape(http, url, label),
    pixeldrain: (url, label) => extractPixeldrain(url, label),
  };
}
