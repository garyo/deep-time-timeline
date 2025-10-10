/**
 * Cloudflare Worker for Timeline Events API
 * Fetches global news and filters for significant events
 */

// Configuration
const CACHE_TTL = 60 * 60; // Cache for 1 hour. Reddit limit is 60 req/min, 10M req/day
const MAX_ARTICLES = 200;
const MIN_ARTICLES = 8;
const BASE_SIGNIFICANCE = 0;
const SIGNIFICANCE_THRESHOLD = 5;
const MAX_SIGNIFICANCE = 9
const REDDIT_NEWS_PERIOD = 'day';    // hour, day, week, month, year, all -- no other values

// Keywords that indicate potentially significant events
const SIGNIFICANCE_KEYWORDS = {
  // High significance
  5: [
    'war declared', 'nuclear', 'world war', 'pandemic declared', 'climate emergency',
    'major earthquake', 'volcanic eruption', 'asteroid', 'breakthrough discovery',
    'peace treaty signed', 'independence declared', 'powerful earthquake'
  ],
  4: [
    'president elected', 'prime minister', 'major election', 'constitutional',
    'supreme court', 'invasion', 'cease fire', 'historic agreement',
    'breakthrough', 'first time', 'record breaking', 'unconstitutional', 'earthquake',
    'peace agreement'
  ],
  3: [
    'election', 'protest', 'strike', 'scandal', 'resignation', 'appointed',
    'trade agreement', 'sanctions', 'diplomat', 'summit', 'crisis', 'pandemic',
    'nobel prize'
  ],
  // Medium significance 
  2: [
    'economy', 'stock market', 'recession', 'inflation', 'unemployment',
    'technology', 'AI', 'space', 'climate', 'environment', 'covid', 'infected',
    'strikes down', 'killed', /deportations?/
  ],
  1: [
    'company', 'business', 'merger', 'acquisition', 'bankruptcy',
    'innovation', 'research', 'study', 'report', 'president'
  ],
  1: [
    'culture', 'art', 'music', 'film', 'book', 'award'
  ],
  0: [
    'celebrity', 'entertainment', 'sports', 
  ]
};

// Countries/regions that tend to generate globally significant news
const SIGNIFICANT_SOURCES = {
  3: ['us', 'cn', 'ru', 'gb', /ny.?times/], // Major powers & vetted sources
  2: ['de', 'fr', 'jp', 'in', 'br'], // Regional powers & good sources
  1: ['ca', 'au', 'kr', 'it', 'es', 'wsj', 'nbc'], // Developed nations & medium sources
  0: ['mx', 'za', 'tr', 'eg', 'ir'] // Regional influencers
};

/**
 * Calculate significance score for a news article
 */
function calculateSignificance(article) {
  const title = (article.title || '').toLowerCase();
  const description = (article.description || '').toLowerCase();
  const content = `${title} ${description}`;
  
  let maxScore = BASE_SIGNIFICANCE; // Default minimum significance
  
  // Check for significance keywords
  let kwdsMatched = []
  let sigScore = 0
  for (const [score, keywords] of Object.entries(SIGNIFICANCE_KEYWORDS)) {
    for (const keyword of keywords) {
      const pat = keyword instanceof RegExp ? keyword : new RegExp(`\\b${keyword}\\b`, 'i')
      if (content.match(pat)) {
        kwdsMatched.push(keyword)
        sigScore += parseInt(score)
      }
    }
  }
  maxScore += sigScore
  
  // Boost score based on source country/importance
  let sourceBoost = 0
  const source = article.source?.name?.toLowerCase() || '';
  for (const [boost, sources] of Object.entries(SIGNIFICANT_SOURCES)) {
    for (const pattern of sources) {
      const pat = pattern instanceof RegExp ? pattern : new RegExp(`\\b${pattern}\\b`, 'i')
      if (source.match(pat) || content.match(pat)) {
        sourceBoost = Math.max(sourceBoost, parseInt(boost))
        break;
      }
    }
  }
  maxScore = maxScore + sourceBoost;
  const sourceScore = maxScore;
  
  // Additional heuristics
  if (title.length > 100) maxScore += 1; // Detailed headlines often important
  if (content.includes('breaking')) maxScore += 1;
  if (content.includes('urgent')) maxScore += 2;
  if (content.includes('viral')) maxScore -= 2;
  if (content.match(/(lad|sport).?bible/i)) maxScore -= 5;
  if (content.match(/\/r.*thread/i)) maxScore -= 2; // reddit meta
  
  console.log(`Score ${maxScore} for "${title.slice(0, 60)}": from sig -> ${sigScore}(${kwdsMatched}) -> source -> ${sourceScore}(${sourceBoost})`)
  return Math.min(MAX_SIGNIFICANCE, Math.max(1, maxScore));
}

/**
 * Filter articles to only include significant ones
 */
function filterSignificantEvents(articles) {
  let articlesWithSignificance = articles.map(article => ({
      ...article,
      significance: calculateSignificance(article)
    }))

  // Find a threshold that returns "enough" articles
  let threshold= SIGNIFICANCE_THRESHOLD
  while (threshold > BASE_SIGNIFICANCE) {
    const n = articlesWithSignificance.filter(article => article.significance >= threshold).length
    console.log(`Threshold of ${threshold} gives ${n} articles (need ${MIN_ARTICLES})`)
    if (n >= MIN_ARTICLES)
      break
    threshold--
  }
  console.log(`Using threshold of ${threshold}`)

  return articlesWithSignificance
    .filter(article => article.significance >= threshold) // Only include significance above threshold
    .sort((a, b) => b.significance - a.significance) // Sort by significance
}

/**
 * Fetch news from API
 */


// Get Reddit oauth token
async function getToken(env) {
  // const creds = Buffer.from(`${client_id}:${client_secret}`).toString('base64'); // Node.js
  const creds = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + creds,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'script:deep-timeline:v1.0 (by /u/simplex5d)' // Required!
    },
    body: `grant_type=password&username=${encodeURIComponent(env.REDDIT_USERNAME)}&password=${encodeURIComponent(env.REDDIT_PASSWORD)}`
  });
  if (res.ok) {
    const data = await res.json();
    if (data.error) {
      console.error(`Error getting Reddit access token for ${env.REDDIT_USERNAME}: ${data.error} (maybe wrong password?)`)
      return undefined
    }
    return data.access_token;
  }
  else {
    console.error(`Can't get reddit token for ${env.REDDIT_USERNAME}`)
    return undefined
  }
}

async function getTopPosts(token, n = 10, period) {
  const headers = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'my-news-proxy/0.1 by simplex5d'
    }
  const res = await fetch(`https://oauth.reddit.com/r/worldnews/top?limit=${n}&t=${period}`, {
    headers: headers
  });
  const data = await res.json();
  return data.data.children.map(x => {
    const post = x.data;
    return {
      title: post.title,
      date: new Date(post.created_utc * 1000).toISOString(),
      content: post.selftext || null,
      url: post.url
    };
  });
}

/**
 * Fetch from Reddit
 * returns {title, ISO date, description (maybe), content, significance=0}
 */
async function fetchNews(env) {
  const token = await getToken(env);
  if (!token)
    return []
  const [posts1, posts2] = await Promise.all([
    getTopPosts(token, MAX_ARTICLES, REDDIT_NEWS_PERIOD),
    getTopPosts(token, MAX_ARTICLES, 'day')
  ]);
  let posts = [...posts1, ...posts2];

  // dedupe
  const seen = new Set();
  posts = posts.filter(post => {
    if (seen.has(post.title)) return false;
    seen.add(post.title);
    return true;
  });

  posts.forEach(post => {
    // console.log(`Post object has keys ${Object.keys(posts[0])}`); // title, date, content, url
    console.log(`"${post.title}"\n  Date: ${post.date}\n  Content: ${post.content}\n  URL: ${post.url}`);
  });
  const articles = posts.map(post => {
    return {title: post.title,
      date: post.date,
      description: post.description || '',
      content: post.content,
      significance: BASE_SIGNIFICANCE};
  })
  return articles;
}

/**
 * Main handler
 */
export default {
  async fetch(request, env, ctx) {
    console.log(`Worker started - request method: ${request.method}`);
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    // Check cache
    let cache = caches.default;
    const cacheUrl = new URL(request.url);
    console.log(`Checking cache URL ${cacheUrl}.`);
    // Create cache key with URL only (no request headers) for global caching
    const cacheKey = new Request(`https://${cacheUrl.hostname}${cacheUrl.pathname}`)
    let cresponse = await cache.match(cacheKey);
    if (cresponse) {
      console.log(`Cache hit; returning cached response.`);
      return cresponse;
    }


    let articles;
    let timelineEvents = [];
    try {
      // Get API key from environment variables
      articles = await fetchNews(env);

      // Process articles
      articles = filterSignificantEvents(articles);
      // timeline events have name, date, significance
      timelineEvents = articles.map(a => {
        console.log(`Sig ${a.significance} for Article "${a.title}"`)
        return {name: a.title, date: a.date, significance: a.significance};
      });

      console.log(`Processed ${articles.length} articles, returning ${timelineEvents.length} events`);

    } catch (error) {
      console.error('Error fetching news:', error);
      articles = [];
    }
        
    // Create response with optional debug info
    const responseData = timelineEvents;
    const response = new Response(JSON.stringify(responseData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}`,
      },
    });

    // cache it
    console.log(`Caching response under ${cacheKey.url} with TTL=${CACHE_TTL}`)
    ctx.waitUntil(cache.put(cacheKey, response.clone()))

    return response;
  }
}
