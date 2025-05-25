# Cloudflare Worker Deployment Guide

This monorepo contains the Cloudflare worker in `timeline-events-worker/timeline-events`.


## Overview
This Cloudflare Worker fetches global news and converts it into timeline events with significance scoring.

## Setup Steps

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
```

### 2. Login to Cloudflare
```bash
wrangler login
```

### 4. Local Development Setup
```bash
% cd timeline-events-worker/timeline-events
# Create your local .dev.vars file
NEWS_API_KEY=your_actual_api_key_here
```

### 5. Get a News API Key (Optional but Recommended)
1. Go to [newsapi.org](https://newsapi.org/)
2. Sign up for a free account (1000 requests/month)
3. Get your API key
4. Add it to your `.dev.vars` file locally

### 6. Set Production Secrets (SECURE)
```bash
# Set the API key as a secret in Cloudflare (production)
wrangler secret put NEWS_API_KEY
# You'll be prompted to enter the key securely

# For development environment
wrangler secret put NEWS_API_KEY --env development
```

### 7. Deploy
```bash
# Test locally first (reads from .env file)
wrangler dev

# Deploy to development (uses Cloudflare secrets)
wrangler deploy --env development

# Deploy to production (uses Cloudflare secrets)
wrangler deploy --env production
```

## 🔐 **Security Best Practices:**

**Local Development:**
- Create `.dev.vars` file for local testing (never commit this!)
- The `.dev.vars` file is in `.gitignore` so it won't be pushed to GitHub
- Use `wrangler dev` to test locally with your `.dev.vars` file

**Production Deployment:**
- Use `wrangler secret put` to securely store API keys in Cloudflare
- Secrets are encrypted and never visible in your code or GitHub
- Different secrets for development/production environments

**What gets committed to GitHub:**
- ✅ `worker.js` (no secrets in the code)
- ✅ `wrangler.toml` (no secrets, just configuration)
- ✅ `.gitignore` (protects your actual `.env` file)
- ❌ `.dev.vars` (your actual secrets - protected by .gitignore)

## Configuration

### Significance Scoring
The worker scores news events 1-10 based on:

**Keywords** (modify `SIGNIFICANCE_KEYWORDS`):

**Source Importance** (modify `SIGNIFICANT_SOURCES`):

### Customization Options

**Filter Threshold**: Change minimum significance
```javascript
.filter(article => article.significance >= 5) // Adjust this number
```

**Event Limit**: Change max events returned
```javascript
.slice(0, 20); // Adjust this number
```

**Cache Duration**: Change how long responses are cached (currently 5 minutes)
```javascript
const CACHE_TTL = 300; // Seconds
```

**Keywords**: Add your own important keywords
```javascript
const SIGNIFICANCE_KEYWORDS = {
  10: [..., 'your-important-keyword'],
  // ...
};
```

## API Endpoint

Once deployed, your API will be available at:
```
https://timeline-events-api.your-subdomain.workers.dev/
```

Update your timeline configuration to use this URL:
```javascript
const apiUrl = 'https://timeline-events-api.your-subdomain.workers.dev/';
```

## Testing

Test your worker locally:
```bash
wrangler dev
```

Then visit `http://localhost:8787` to see the JSON response.

## Rate Limits & Costs

- **NewsAPI Free**: 1000 requests/month, 30/day
- **Cloudflare Workers Free**: 100,000 requests/day
- **Caching**: Responses cached for 5 minutes to reduce API calls

## Alternative News Sources

If you don't want to use NewsAPI, the worker includes fallback RSS parsing. You can also integrate with:

- **Guardian API** (free, higher limits)
- **NY Times API** (free tier available)
- **RSS feeds** (no API key needed)
- **Reddit API** (for trending topics)

## Monitoring

View worker logs and analytics in the Cloudflare dashboard under Workers & Pages.
