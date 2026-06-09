#!/usr/bin/with-contenv bashio

# Read config options and export as environment variables
export PORT=4310
export HOST="0.0.0.0"

export SPORTS_API_KEY=$(bashio::config 'SPORTS_API_KEY')
export FOOTBALL_DATA_API_KEY=$(bashio::config 'FOOTBALL_DATA_API_KEY')
export WEATHER_LATITUDE=$(bashio::config 'WEATHER_LATITUDE')
export WEATHER_LONGITUDE=$(bashio::config 'WEATHER_LONGITUDE')
export WEATHER_TIMEZONE=$(bashio::config 'WEATHER_TIMEZONE')
export GOOGLE_CLIENT_ID=$(bashio::config 'GOOGLE_CLIENT_ID')
export GOOGLE_CLIENT_SECRET=$(bashio::config 'GOOGLE_CLIENT_SECRET')
export GOOGLE_REDIRECT_URI=$(bashio::config 'GOOGLE_REDIRECT_URI')
export GOOGLE_CALENDAR_ME_ID=$(bashio::config 'GOOGLE_CALENDAR_ME_ID')
export GOOGLE_CALENDAR_PARTNER_ID=$(bashio::config 'GOOGLE_CALENDAR_PARTNER_ID')
export GOOGLE_CALENDAR_SHARED_ID=$(bashio::config 'GOOGLE_CALENDAR_SHARED_ID')

# Home Assistant internal API — automatisch beschikbaar binnen addons
export HOME_ASSISTANT_URL="http://supervisor/core"
export HOME_ASSISTANT_TOKEN="${SUPERVISOR_TOKEN}"

# Zorg dat de data directory bestaat (persistent storage)
mkdir -p /data

# Symlink .data -> /data zodat de server zijn caches persistent opslaat
ln -sfn /data /app/.data

bashio::log.info "Home Planner starten op poort ${PORT}..."
exec node /app/src/server.js
