/**
 * Showrush SuperStream & AutoEmbed HD Provider
 * High-speed HLS direct master stream resolver with 1080p/720p/480p adaptive bitrate.
 */

return {
  id: "com.community.superstream",
  name: "SuperStream & AutoEmbed HD",
  version: "1.5.0",
  author: "Showrush Community",
  description: "Fast adaptive bitrate HLS resolver with multi-server CDN redundancy.",
  types: ["movie", "tv"],

  async getStreams(query) {
    const { tmdbId, type, season = 1, episode = 1 } = query;
    if (!tmdbId) return [];

    try {
      const isTv = type === 'tv';
      const streams = [];

      // AutoEmbed / SuperStream endpoints
      const mirrors = [
        {
          name: 'SuperStream Pro (1080p Direct)',
          url: isTv
            ? `https://autoembed.cc/embed/player.php?id=${tmdbId}&s=${season}&e=${episode}`
            : `https://autoembed.cc/embed/player.php?id=${tmdbId}`,
        },
        {
          name: 'SmashyStream Multi-CDN',
          url: isTv
            ? `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}&season=${season}&episode=${episode}`
            : `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}`,
        },
      ];

      for (const [idx, mirror] of mirrors.entries()) {
        try {
          const res = await Showrush.http.get(mirror.url, {
            headers: {
              'Referer': 'https://autoembed.cc/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });

          if (res.ok && res.data) {
            const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            const m3u8Match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/);

            if (m3u8Match) {
              streams.push({
                id: `superstream-${idx}-${Date.now()}`,
                name: mirror.name,
                server: `SuperStream ${idx + 1}`,
                url: m3u8Match[1],
                quality: '1080p',
                isM3U8: true,
                headers: {
                  'Referer': mirror.url,
                },
              });
            }
          }
        } catch {}
      }

      return streams;
    } catch (err) {
      console.warn('[SuperStream Provider] Error:', err);
      return [];
    }
  },

  // 🌟 Source Offered Catalog: Curated Hollywood & Cinema Feeds
  async getCatalogFeeds(page = 1) {
    const API_KEY = '45dbdd59a37181dc2e7745b296338b21';
    const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
    try {
      const [moviesRes, tvRes, topRes] = await Promise.allSettled([
        fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}&page=${page}`),
        fetch(`https://api.themoviedb.org/3/trending/tv/week?api_key=${API_KEY}&page=${page}`),
        fetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}&page=${page}`),
      ]);

      const feeds = [];

      // 1. Trending Movies
      if (moviesRes.status === 'fulfilled' && moviesRes.value.ok) {
        const data = await moviesRes.value.json();
        const results = data.results || [];
        if (results.length > 0) {
          feeds.push({
            id: 'superstream-trending-movies',
            title: '🔥 Trending Hollywood Cinema',
            items: results.map((m) => ({
              id: String(m.id),
              title: m.title || m.original_title,
              poster: m.poster_path ? `${IMG_BASE}${m.poster_path}` : undefined,
              type: 'movie',
              year: m.release_date ? m.release_date.slice(0, 4) : undefined,
              rating: m.vote_average,
              qualityBadge: '4K',
            })),
          });
        }
      }

      // 2. Binge-Worthy TV Series
      if (tvRes.status === 'fulfilled' && tvRes.value.ok) {
        const data = await tvRes.value.json();
        const results = data.results || [];
        if (results.length > 0) {
          feeds.push({
            id: 'superstream-trending-tv',
            title: '⚡ Popular Binge-Worthy Series',
            items: results.map((t) => ({
              id: String(t.id),
              title: t.name || t.original_name,
              poster: t.poster_path ? `${IMG_BASE}${t.poster_path}` : undefined,
              type: 'tv',
              year: t.first_air_date ? t.first_air_date.slice(0, 4) : undefined,
              rating: t.vote_average,
              qualityBadge: '1080p',
            })),
          });
        }
      }

      // 3. Top Rated
      if (topRes.status === 'fulfilled' && topRes.value.ok) {
        const data = await topRes.value.json();
        const results = data.results || [];
        if (results.length > 0) {
          feeds.push({
            id: 'superstream-top-rated',
            title: '👑 All-Time Top Rated Masterpieces',
            items: results.map((m) => ({
              id: String(m.id),
              title: m.title || m.original_title,
              poster: m.poster_path ? `${IMG_BASE}${m.poster_path}` : undefined,
              type: 'movie',
              year: m.release_date ? m.release_date.slice(0, 4) : undefined,
              rating: m.vote_average,
              qualityBadge: 'TOP',
            })),
          });
        }
      }

      return feeds;
    } catch (err) {
      console.warn('[SuperStream getCatalogFeeds] Notice:', err);
      return [];
    }
  },
};
