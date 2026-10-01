export const API_KEY_DEFINITIONS = [
  { provider: 'news', keyName: 'NEWS_API_KEY', displayLabel: 'NewsAPI', category: 'news', description: 'NewsAPI headline search. GDELT remains available as a public fallback.', isRequired: false, sortOrder: 1 },
  { provider: 'weather', keyName: 'OPENWEATHER_API_KEY', displayLabel: 'OpenWeather', category: 'weather', description: 'Current conditions for tracked global cities; Open-Meteo is used when this key is absent.', isRequired: false, sortOrder: 2 },
  { provider: 'markets', keyName: 'FINNHUB_API_KEY', displayLabel: 'Finnhub', category: 'markets', description: 'Stock quotes for the markets pulse panel.', isRequired: false, sortOrder: 3 },
  { provider: 'acled', keyName: 'ACLED_EMAIL', displayLabel: 'ACLED account email', category: 'conflict', description: 'Email for ACLED OAuth authentication.', isRequired: false, sortOrder: 4 },
  { provider: 'acled', keyName: 'ACLED_PASSWORD', displayLabel: 'ACLED account password', category: 'conflict', description: 'Password for ACLED OAuth authentication.', isRequired: false, sortOrder: 5, isPassword: true },
  { provider: 'flights', keyName: 'OPENSKY_CLIENT_ID', displayLabel: 'OpenSky client ID', category: 'aviation', description: 'OAuth2 client ID for OpenSky state vectors.', isRequired: false, sortOrder: 6 },
  { provider: 'flights', keyName: 'OPENSKY_CLIENT_SECRET', displayLabel: 'OpenSky client secret', category: 'aviation', description: 'OAuth2 client secret for OpenSky state vectors.', isRequired: false, sortOrder: 7, isPassword: true },
  { provider: 'ships', keyName: 'AISSTREAM_API_KEY', displayLabel: 'AISStream', category: 'maritime', description: 'AIS vessel positions near selected strategic waterways.', isRequired: false, sortOrder: 8, isPassword: true },
  { provider: 'firms', keyName: 'NASA_FIRMS_API_KEY', displayLabel: 'NASA FIRMS', category: 'natural', description: 'Satellite fire and thermal anomaly detections.', isRequired: false, sortOrder: 9, isPassword: true },
  { provider: 'energy', keyName: 'EIA_API_KEY', displayLabel: 'U.S. EIA', category: 'energy', description: 'U.S. petroleum and energy series.', isRequired: false, sortOrder: 10, isPassword: true },
  { provider: 'macro', keyName: 'FRED_API_KEY', displayLabel: 'FRED', category: 'economics', description: 'Federal Reserve economic indicators.', isRequired: false, sortOrder: 11, isPassword: true },
  { provider: 'youtube', keyName: 'YOUTUBE_API_KEY', displayLabel: 'YouTube Data API', category: 'media', description: 'Searches for currently-live public video streams.', isRequired: false, sortOrder: 12, isPassword: true },
  { provider: 'windy', keyName: 'WINDY_API_KEY', displayLabel: 'Windy Webcams', category: 'weather', description: 'Optional webcam metadata from Windy.', isRequired: false, sortOrder: 13, isPassword: true },
  { provider: 'openai', keyName: 'OPENAI_API_KEY', displayLabel: 'OpenAI API key', category: 'ai', description: 'Server-side OpenAI key for model-generated briefings, analyst answers and country briefs; the local digest is labelled when no key is configured.', isRequired: false, sortOrder: 14, isPassword: true },
];

export const KEY_DEFINITION_BY_NAME = new Map(API_KEY_DEFINITIONS.map((definition) => [definition.keyName, definition]));
