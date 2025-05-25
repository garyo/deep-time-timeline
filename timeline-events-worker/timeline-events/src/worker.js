/**
 * Cloudflare Worker for Timeline Events API
 * Fetches global news and filters for significant events
 */

// Configuration
const NEWS_API_URL = 'https://newsapi.org/v2/top-headlines';
const CACHE_TTL = 300; // Cache for 5 minutes

// Keywords that indicate potentially significant events
const SIGNIFICANCE_KEYWORDS = {
  // High significance
  5: [
    'war declared', 'nuclear', 'world war', 'pandemic declared', 'climate emergency',
    'major earthquake', 'volcanic eruption', 'asteroid', 'breakthrough discovery',
    'peace treaty signed', 'independence declared'
  ],
  4: [
    'president elected', 'prime minister', 'major election', 'constitutional',
    'supreme court', 'invasion', 'cease fire', 'historic agreement',
    'breakthrough', 'first time', 'record breaking', 'unconstitutional'
  ],
  3: [
    'election', 'protest', 'strike', 'scandal', 'resignation', 'appointed',
    'trade agreement', 'sanctions', 'diplomat', 'summit', 'crisis', 'pandemic'
  ],
  // Medium significance 
  2: [
    'economy', 'stock market', 'recession', 'inflation', 'unemployment',
    'technology', 'AI', 'space', 'climate', 'environment', 'covid', 'infected',
    'strikes down', 'killed', /deportations?/
  ],
  1: [
    'company', 'business', 'merger', 'acquisition', 'bankruptcy',
    'innovation', 'research', 'study', 'report'
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
  
  let maxScore = 2; // Default minimum significance
  
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
  
  console.log(`Significance of ${title} = ${maxScore} from sig -> ${sigScore}(${kwdsMatched}) -> source -> ${sourceScore}(${sourceBoost})`)
  return Math.min(10, Math.max(1, maxScore));
}

/**
 * Filter articles to only include significant ones
 */
function filterSignificantEvents(articles) {
  return articles
    .map(article => ({
      ...article,
      significance: calculateSignificance(article)
    }))
    .filter(article => article.significance >= 5) // Only include significance 5+
    .sort((a, b) => b.significance - a.significance) // Sort by significance
    .slice(0, 100); // Limit to top 50 events
}

/**
 * Convert news articles to timeline event format
 */
function convertToTimelineEvents(articles) {
  return articles.map(article => {
    // Use published date, fallback to current date
    let date = new Date().toISOString();
    if (article.publishedAt) {
      date = new Date(article.publishedAt).toISOString();
    }
    
    return {
      name: article.title || 'Untitled Event',
      date: date,
      significance: article.significance || 5
    };
  });
}

/**
 * Fetch news from NewsAPI
 */
async function fetchNews(apiKey) {
  // Needs sources, q, language, country, or category.
  // source.id = the-washington-post, the-wall-street-journal, bbc-news, google-news
  const url = `${NEWS_API_URL}?apiKey=${apiKey}&pageSize=100&sortBy=popularity&sources=the-washington-post,the-wall-street-journal,bbc-news,google-news&language=en`;
  
  console.log(`Making request to: ${NEWS_API_URL}?apiKey=***&pageSize=100&sortBy=popularity&country=us`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Timeline-Events-Worker/1.0 (https://your-domain.com)'
    }
  });
  console.log(`NewsAPI response status: ${response.status}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`NewsAPI error response:`, errorText);
    throw new Error(`News API error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log(`NewsAPI returned ${data.articles?.length || 0} articles`);
  for (const a of data.articles) {
    console.log(JSON.stringify(a, undefined, 2))
  }
  return data.articles || [];
}

/**
 * Alternative: Fetch from RSS feeds (no API key required)
 */
async function fetchNewsFromRSS() {
  // Using RSS feeds as backup - you might want to use an RSS-to-JSON service
  const rssFeeds = [
    'https://rss.cnn.com/rss/edition.rss',
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.reuters.com/rssFeed/worldNews'
  ];
  
  // This is a simplified approach - in reality you'd want to parse RSS XML
  // For now, return some sample events to demonstrate the structure
  return [
    {
      title: 'Global Climate Summit Reaches Historic Agreement',
      publishedAt: new Date().toISOString(),
      description: 'World leaders agree on unprecedented climate action',
      source: { name: 'Reuters' }
    },
    {
      title: 'Major Technological Breakthrough Announced',
      publishedAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      description: 'Scientists achieve quantum computing milestone',
      source: { name: 'BBC' }
    }
  ];
}

/**
 * Main handler
 */
export default {
  async fetch(request, env, ctx) {
    console.log(`Worker started - request method: ${request.method}`);
    console.log(`Environment keys available:`, Object.keys(env));
    console.log(`NEWS_API_KEY type:`, typeof env.NEWS_API_KEY);
    console.log(`NEWS_API_KEY length:`, env.NEWS_API_KEY?.length);
    console.log(`NEWS_API_KEY value:`, env.NEWS_API_KEY ? `${env.NEWS_API_KEY.substring(0, 8)}...` : 'undefined');
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
    
    try {
      // Get API key from environment variables
      const NEWS_API_KEY = env.NEWS_API_KEY;
      console.log(`API key status: ${NEWS_API_KEY ? 'Found' : 'Missing'}`);
      
      // Check cache first (unless nocache is requested)
      const url = new URL(request.url);
      const skipCache = url.searchParams.has('nocache');
      
      const cache = caches.default;
      const cacheKey = new Request('https://timeline-events-cache.oberbrunner.com/events-v2'); // Changed cache key
      let response = skipCache ? null : await cache.match(cacheKey);
      
      if (!response) {
        console.log('Cache miss - fetching fresh news data');
        
        let articles;
        try {
          // Try NewsAPI first (requires API key)
          if (NEWS_API_KEY) {
            console.log('Attempting to fetch from NewsAPI...');
            articles = await fetchNews(NEWS_API_KEY);
            console.log(`Successfully fetched ${articles.length} articles from NewsAPI`);
          } else {
            console.log('No NEWS_API_KEY found, using fallback RSS data');
            // Fallback to RSS or sample data
            articles = await fetchNewsFromRSS();
          }
        } catch (error) {
          console.error('Error fetching news:', error);
          console.log('Falling back to RSS data due to error');
          // Return fallback events
          articles = await fetchNewsFromRSS();
        }
        
        // Process articles
        const significantArticles = filterSignificantEvents(articles);
        const timelineEvents = convertToTimelineEvents(significantArticles);
        
        console.log(`Processed ${articles.length} total articles, ${significantArticles.length} significant, returning ${timelineEvents.length} events`);
        
        // Debug info (temporary - remove in production)
        const debugInfo = {
          totalArticles: articles.length,
          significantCount: significantArticles.length,
          hasApiKey: !!NEWS_API_KEY,
          cacheStatus: 'miss',
          timestamp: new Date().toISOString(),
          sampleTitles: articles.slice(0, 3).map(a => a.title)
        };
        
        // Create response with optional debug info
        const responseData = request.url.includes('debug=1') 
          ? { events: timelineEvents, debug: debugInfo }
          : timelineEvents;
        response = new Response(JSON.stringify(responseData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': `public, max-age=${CACHE_TTL}`,
          },
        });
        
        // Cache the response
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      } else {
        console.log('Cache hit - returning cached data');
      }
      
      return response;
      
    } catch (error) {
      console.error('Worker error:', error);
      
      // Return fallback events on error
      const fallbackEvents = [
        {
          name: 'API Service Temporarily Unavailable',
          date: new Date().toISOString().split('T')[0],
          significance: 3
        }
      ];
      
      return new Response(JSON.stringify(fallbackEvents), {
        status: 200, // Return 200 so timeline doesn't break
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
