# Debugging Cloudflare Workers

## **Method 1: Wrangler Tail (Best for Production Debugging)**

Deploy your worker first, then stream live logs:

```bash
# Navigate to your worker directory
cd timeline-events-worker/timeline-events

# Deploy to development
wrangler deploy --env development

# Stream live logs
wrangler tail --env development

# In another terminal, make requests to see logs
curl "https://timeline-events-api-dev.your-subdomain.workers.dev/"
```

## **Method 2: Local Development with Better Logging**

```bash
# Run with verbose output
wrangler dev --log-level debug

# Or with compatibility settings
wrangler dev --compatibility-date 2024-01-01 --log-level debug
```

## **Method 3: Debug URL Parameter**

I've added a debug mode to your worker. Visit:
```
http://localhost:8787/?debug=1
```

This will return extra debug information in the response:
```json
{
  "events": [...],
  "debug": {
    "totalArticles": 100,
    "significantCount": 15,
    "hasApiKey": true,
    "cacheStatus": "miss",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "sampleTitles": ["Sample News Title 1", "Sample News Title 2"]
  }
}
```

## **Method 4: Browser Developer Tools**

When using `wrangler dev`:
1. Open `http://localhost:8787/`
2. Open browser DevTools (F12)
3. Check the Network tab for the request/response
4. Console logs should appear in the terminal running `wrangler dev`

## **Method 5: Cloudflare Dashboard**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to Workers & Pages
3. Click on your worker
4. Go to "Logs" tab for real-time logging
5. Or "Analytics" for performance metrics

## **Common Issues & Solutions**

**Console.log not showing locally:**
```bash
# Try these flags
wrangler dev --log-level debug --local --persist
```

**Check if your API key is set:**
```bash
# List secrets
wrangler secret list

# Set secret if missing
wrangler secret put NEWS_API_KEY
```

**Test without cache:**
Add `?nocache=1` to your URL to bypass worker cache

**Verify environment:**
```bash
# Check which environment you're debugging
wrangler whoami
wrangler account list
```

## **Quick Debug Checklist**

1. ✅ Are you seeing "Here we go" log?
2. ✅ Is `Got api key` showing your key (or undefined)?
3. ✅ Are you seeing cache miss/hit messages?
4. ✅ Try the `?debug=1` URL parameter
5. ✅ Use `wrangler tail` for deployed workers

## **Example Debug Session**

```bash
# Terminal 1: Start development server
cd timeline-events-worker/timeline-events
wrangler dev --log-level debug

# Terminal 2: Test and debug
curl "http://localhost:8787/?debug=1" | jq
```

Your console.log statements should definitely appear with these methods!
