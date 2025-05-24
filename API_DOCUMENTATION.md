# Significant Events API

## Endpoint

`GET https://example.com/api/significant-events`

## Response Format

The API should return a JSON array of event objects with the following structure:

```json
[
  {
    "name": "Event Name",
    "date": "Date String",
    "significance": 5
  }
]
```

### Event Object Properties

- **name** (string): The name/title of the historical event
- **date** (string): The date of the event in one of these formats supported by DeepTime:
  - Plain years: `"2025"`, `"1984"`
  - BC/BCE dates: `"1000BC"`, `"3200BCE"`
  - AD/CE dates: `"2025AD"`, `"1984CE"`
  - ISO 8601 dates: `"2025-01-01"` or `"2025-01-01T12:00:00Z"`
  - Geological scales: `"66000000BC"`, `"4540000000BC"`
- **significance** (number): A value from 1-10 indicating the event's significance
  - 1 = Least significant (will be dimmed/transparent)
  - 10 = Most significant (will be fully opaque)

### Example Response

```json
[
  {
    "name": "Internet",
    "date": "1984",
    "significance": 8
  },
  {
    "name": "Industrial Revolution",
    "date": "1775",
    "significance": 9
  },
  {
    "name": "Writing",
    "date": "3200BC",
    "significance": 10
  },
  {
    "name": "First cities",
    "date": "3500BC",
    "significance": 8
  },
  {
    "name": "Agriculture",
    "date": "8000BC",
    "significance": 10
  },
  {
    "name": "Human species",
    "date": "300000BC",
    "significance": 10
  },
  {
    "name": "Dinosaur extinction",
    "date": "66000000BC",
    "significance": 9
  },
  {
    "name": "First life",
    "date": "3800000000BC",
    "significance": 10
  },
  {
    "name": "Earth formation",
    "date": "4540000000BC",
    "significance": 10
  },
  {
    "name": "Big Bang",
    "date": "13800000000BC",
    "significance": 10
  }
]
```

## Error Handling

If the API is unavailable or returns an error, the timeline will automatically fall back to:
1. Loading events from the local `events.json` file
2. Using hardcoded fallback events if the file is also unavailable

## Update Frequency

The timeline automatically polls this API every 5 minutes (300,000ms) for updates. You can modify this interval by changing the `updateInterval` parameter in the `EventUpdater` constructor.

## CORS Requirements

If serving the API from a different domain than your timeline application, ensure proper CORS headers are set:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: Content-Type
```
