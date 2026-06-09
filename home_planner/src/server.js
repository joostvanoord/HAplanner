const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

loadEnvFile();

const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const dataDir = path.join(projectRoot, ".data");
const googleTokenPath = path.join(dataDir, "google-tokens.json");
const sportsCachePath = path.join(dataDir, "sports-cache.json");
const tennisPhotoCachePath = path.join(dataDir, "tennis-photo-cache.json");
const port = Number(process.env.PORT || 4310);
const host = process.env.HOST || "0.0.0.0";

const config = {
  sportsApiKey: process.env.SPORTS_API_KEY || "123",
  footballDataApiKey: process.env.FOOTBALL_DATA_API_KEY || "",
  weatherLatitude: process.env.WEATHER_LATITUDE || "52.3676",
  weatherLongitude: process.env.WEATHER_LONGITUDE || "4.9041",
  weatherTimezone: process.env.WEATHER_TIMEZONE || "Europe/Amsterdam",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/auth/google/callback`,
  googleCalendarMeId: process.env.GOOGLE_CALENDAR_ME_ID || "",
  googleCalendarPartnerId: process.env.GOOGLE_CALENDAR_PARTNER_ID || "",
  googleCalendarSharedId: process.env.GOOGLE_CALENDAR_SHARED_ID || "",
  homeAssistantUrl: process.env.HOME_ASSISTANT_URL || "",
  homeAssistantToken: process.env.HOME_ASSISTANT_TOKEN || ""
};

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

const demoData = {
  calendar: {
    me: {
      owner: "Joost",
      items: [
        { id: "me-1", title: "Tandarts", start: "2026-06-06T12:00:00+02:00", end: "2026-06-06T12:30:00+02:00" },
        { id: "me-2", title: "Lunch Teerd", start: "2026-06-06T14:00:00+02:00", end: "2026-06-06T15:00:00+02:00" }
      ]
    },
    partner: {
      owner: "Nadine",
      items: [
        { id: "partner-1", title: "Pilates", start: "2026-06-06T11:30:00+02:00", end: "2026-06-06T12:30:00+02:00" },
        { id: "partner-2", title: "Belafspraak", start: "2026-06-06T16:15:00+02:00", end: "2026-06-06T16:45:00+02:00" }
      ]
    },
    shared: {
      owner: "Samen",
      items: [
        { id: "shared-1", title: "Diner samen", start: "2026-06-06T18:30:00+02:00", end: "2026-06-06T20:00:00+02:00" }
      ]
    }
  },
  home: {
    lights: [
      { entityId: "light.standing_lamp", label: "Standing lamp", room: "Living Room", isOn: true, dimmable: false },
      { entityId: "light.mood_lights", label: "Mood lights", room: "Living Room", isOn: true, dimmable: true, brightness: 58 },
      { entityId: "light.lampie", label: "Lampie", room: "Living Room", isOn: false, dimmable: false },
      { entityId: "light.table_lights", label: "Table lights", room: "Living Room", isOn: true, dimmable: true, brightness: 71 },
      { entityId: "light.kitchen_lights", label: "Kitchen lights", room: "Kitchen", isOn: true, dimmable: true, brightness: 46 },
      { entityId: "light.bedroom_lights", label: "Bedroom lights", room: "Bedroom", isOn: false, dimmable: true, brightness: 34 }
    ]
  },
  weather: {
    currentTemperature: 19,
    expectedTemperature: 21,
    expectedLabel: "Later vandaag",
    summary: "Licht bewolkt, later kans op regen",
    maxTemperature: 21,
    windBft: 3,
    rainChance: 45,
    rain: [
      { label: "Nu", value: 0.1 },
      { label: "+3u", value: 0.2 },
      { label: "+6u", value: 1.6 },
      { label: "+9u", value: 0.7 }
    ]
  },
  news: {
    general: {
      feedTitle: "NOS Nieuws",
      items: [
        {
          title: "NS verwacht extra drukte op meerdere trajecten vanavond",
          source: "NOS Nieuws",
          link: "https://nos.nl/",
          image: null
        },
        {
          title: "Renteverwachting blijft voorlopig stabiel volgens analisten",
          source: "NOS Nieuws",
          link: "https://nos.nl/",
          image: null
        },
        {
          title: "Nederlands team wint overtuigend en tankt vertrouwen",
          source: "NOS Nieuws",
          link: "https://nos.nl/",
          image: null
        }
      ]
    },
    football: {
      feedTitle: "VoetbalPrimeur",
      items: [
        {
          title: "VoetbalPrimeur-feed verschijnt hier zodra de feed is geladen",
          source: "VoetbalPrimeur",
          link: "https://www.voetbalprimeur.nl/",
          image: null
        }
      ]
    }
  },
  sports: {
    todayItems: [
      {
        time: "20:15",
        title: "Sinner vs Alcaraz",
        meta: "Roland Garros",
        type: "tennis"
      },
      {
        time: "21:00",
        title: "PSV vs Ajax",
        meta: "Eredivisie",
        type: "football"
      }
    ],
    upcomingItems: [
      {
        time: "Morgen",
        title: "Nederland vs Engeland",
        meta: "WK groepsfase",
        type: "football"
      },
      {
        time: "09 jun",
        title: "Roland Garros finale",
        meta: "Grand Slam",
        type: "tennis"
      }
    ]
  }
};

let googleAuthState = null;
let sportsCache = {
  expiresAt: 0,
  payload: null,
  store: null
};
let tennisPhotoCache = null;
const homeAssistantAreaCache = new Map();
const HOME_ROOM_ORDER = ["Living Room", "Kitchen", "Bedroom", "Office"];
const HOME_SWITCH_EXCLUDE_PATTERNS = [
  "bridge",
  "permit",
  "join",
  "do not disturb",
  "do_not_disturb",
  "identify",
  "update",
  "restart",
  "coordinator",
  "firmware",
  "ota",
  "pairing"
];

function loadEnvFile() {
  const envPath = path.join(path.resolve(__dirname, ".."), ".env");
  if (!fs.existsSync(envPath)) return;

  const file = fs.readFileSync(envPath, "utf8");
  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readGoogleTokens() {
  try {
    return JSON.parse(fs.readFileSync(googleTokenPath, "utf8"));
  } catch {
    return null;
  }
}

function writeGoogleTokens(tokens) {
  ensureDataDir();
  fs.writeFileSync(googleTokenPath, JSON.stringify(tokens, null, 2));
}

function readSportsStore() {
  try {
    return JSON.parse(fs.readFileSync(sportsCachePath, "utf8"));
  } catch {
    return null;
  }
}

function writeSportsStore(store) {
  ensureDataDir();
  fs.writeFileSync(sportsCachePath, JSON.stringify(store, null, 2));
}

function readTennisPhotoCache() {
  try {
    return JSON.parse(fs.readFileSync(tennisPhotoCachePath, "utf8"));
  } catch {
    return { players: {} };
  }
}

function writeTennisPhotoCache(cache) {
  ensureDataDir();
  fs.writeFileSync(tennisPhotoCachePath, JSON.stringify(cache, null, 2));
}

function isGoogleConfigured() {
  return Boolean(
    config.googleClientId &&
    config.googleClientSecret &&
    config.googleRedirectUri &&
    config.googleCalendarMeId &&
    config.googleCalendarPartnerId &&
    config.googleCalendarSharedId
  );
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function sendPrettyJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function redirect(response, location) {
  response.writeHead(302, { Location: location });
  response.end();
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[extension] || "application/octet-stream";

  fs.readFile(filePath, (error, file) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(response, 404, { error: "Not found" });
        return;
      }

      sendJson(response, 500, { error: "Failed to read file" });
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentType
    });
    response.end(file);
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });
}

function serveStatic(requestPath, response) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const normalizedPath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, normalizedPath);

  if (!filePath.startsWith(publicDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  sendFile(response, filePath);
}

function getGoogleStatus() {
  const tokens = readGoogleTokens();
  return {
    configured: isGoogleConfigured(),
    connected: Boolean(tokens?.refresh_token || tokens?.access_token),
    accountEmail: tokens?.account_email || null,
    hasMeCalendar: Boolean(config.googleCalendarMeId),
    hasPartnerCalendar: Boolean(config.googleCalendarPartnerId),
    hasSharedCalendar: Boolean(config.googleCalendarSharedId)
  };
}

function isHomeAssistantConfigured() {
  return Boolean(config.homeAssistantUrl && config.homeAssistantToken);
}

function getHomeAssistantBaseUrl() {
  return config.homeAssistantUrl.replace(/\/+$/, "");
}

async function fetchHomeAssistantJson(pathname, options = {}) {
  const response = await fetch(`${getHomeAssistantBaseUrl()}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.homeAssistantToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Home Assistant request failed: ${response.status} ${detail}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function fetchHomeAssistantText(pathname, options = {}) {
  const response = await fetch(`${getHomeAssistantBaseUrl()}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.homeAssistantToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Home Assistant request failed: ${response.status} ${detail}`);
  }

  return response.text();
}

function percentFromHomeAssistantBrightness(brightness) {
  if (typeof brightness !== "number" || Number.isNaN(brightness)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((brightness / 255) * 100)));
}

function homeAssistantBrightnessFromPercent(percent) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  return Math.max(1, Math.min(255, Math.round((safe / 100) * 255)));
}

function getEntityDomain(entityId) {
  return String(entityId || "").split(".")[0] || "";
}

function normaliseHomeRoomName(name) {
  const value = String(name || "").trim().toLowerCase();

  if (!value) return "Other";
  if (["living room", "woonkamer", "huiskamer"].includes(value)) return "Living Room";
  if (["kitchen", "keuken"].includes(value)) return "Kitchen";
  if (["bedroom", "slaapkamer"].includes(value)) return "Bedroom";
  if (["office", "kantoor", "werkkamer", "study"].includes(value)) return "Office";
  return String(name || "").trim();
}

function compareHomeRooms(a, b) {
  const aIndex = HOME_ROOM_ORDER.indexOf(a);
  const bIndex = HOME_ROOM_ORDER.indexOf(b);

  if (aIndex !== -1 || bIndex !== -1) {
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    if (aIndex !== bIndex) return aIndex - bIndex;
  }

  return a.localeCompare(b);
}

function shouldIncludeHomeAssistantSwitch(state) {
  const haystack = `${state.entity_id || ""} ${state.attributes?.friendly_name || ""}`.toLowerCase();
  return !HOME_SWITCH_EXCLUDE_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function groupHomeLightsByRoom(lights) {
  const grouped = new Map();

  for (const light of lights) {
    const roomName = light.room || "Overig";
    if (!grouped.has(roomName)) {
      grouped.set(roomName, []);
    }
    grouped.get(roomName).push(light);
  }

  return [...grouped.entries()]
    .sort((a, b) => compareHomeRooms(a[0], b[0]))
    .map(([room, items]) => ({ room, items }));
}

function getCachedHomeAssistantArea(entityId) {
  const cached = homeAssistantAreaCache.get(entityId);
  if (!cached) return null;

  const ageMs = Date.now() - cached.cachedAt;
  if (ageMs > 12 * 60 * 60 * 1000) {
    homeAssistantAreaCache.delete(entityId);
    return null;
  }

  return cached.value;
}

async function inferHomeAssistantRoom(state) {
  const attributeRoom = state.attributes?.room || state.attributes?.area_name;
  if (attributeRoom) {
    return normaliseHomeRoomName(attributeRoom);
  }

  const cached = getCachedHomeAssistantArea(state.entity_id);
  if (cached) {
    return cached;
  }

  try {
    const text = await fetchHomeAssistantText("/api/template", {
      method: "POST",
      body: JSON.stringify({
        template: `{{ area_name('${state.entity_id}') or '' }}`
      })
    });
    const resolved = normaliseHomeRoomName(text.trim() || "Other");
    homeAssistantAreaCache.set(state.entity_id, { value: resolved, cachedAt: Date.now() });
    return resolved;
  } catch {
    return "Other";
  }
}

async function mapHomeAssistantControllable(state) {
  const domain = getEntityDomain(state.entity_id);
  const supportedColorModes = state.attributes?.supported_color_modes || [];
  const hasBrightness = typeof state.attributes?.brightness === "number";
  const dimmable = domain === "light" && (hasBrightness || supportedColorModes.length > 0);

  return {
    entityId: state.entity_id,
    domain,
    label: state.attributes?.friendly_name || state.entity_id,
    room: await inferHomeAssistantRoom(state),
    isOn: state.state === "on",
    dimmable,
    brightness: hasBrightness ? percentFromHomeAssistantBrightness(state.attributes.brightness) : 0,
    unavailable: state.state === "unavailable"
  };
}

async function fetchHomeAssistantLightsPayload() {
  const states = await fetchHomeAssistantJson("/api/states");
  const relevantStates = (Array.isArray(states) ? states : [])
    .filter((state) => ["light", "switch"].includes(getEntityDomain(state.entity_id)))
    .filter((state) => getEntityDomain(state.entity_id) !== "switch" || shouldIncludeHomeAssistantSwitch(state))
    .filter((state) => !state.attributes?.hidden)
    .filter((state) => !state.attributes?.entity_category)
    .filter((state) => state.state !== "unknown")
    .sort((a, b) => (a.attributes?.friendly_name || a.entity_id).localeCompare(b.attributes?.friendly_name || b.entity_id));

  const entities = await Promise.all(relevantStates.map(mapHomeAssistantControllable));
  entities.sort((a, b) => compareHomeRooms(a.room, b.room) || a.label.localeCompare(b.label));

  return {
    source: "home-assistant",
    entities,
    rooms: groupHomeLightsByRoom(entities)
  };
}

async function setHomeAssistantEntitiesState(entityIds, desiredState) {
  const grouped = new Map();

  for (const entityId of entityIds) {
    const domain = getEntityDomain(entityId);
    if (!grouped.has(domain)) {
      grouped.set(domain, []);
    }
    grouped.get(domain).push(entityId);
  }

  for (const [domain, ids] of grouped.entries()) {
    await fetchHomeAssistantJson(`/api/services/${domain}/${desiredState ? "turn_on" : "turn_off"}`, {
      method: "POST",
      body: JSON.stringify({ entity_id: ids })
    });
  }
}

async function dimHomeAssistantLight(entityIds, brightnessPercent) {
  await fetchHomeAssistantJson("/api/services/light/turn_on", {
    method: "POST",
    body: JSON.stringify({
      entity_id: entityIds,
      brightness: homeAssistantBrightnessFromPercent(brightnessPercent)
    })
  });
}

function mapWeatherCode(code) {
  if ([0].includes(code)) return "Zonnig";
  if ([1, 2].includes(code)) return "Licht bewolkt";
  if ([3].includes(code)) return "Bewolkt";
  if ([45, 48].includes(code)) return "Mistig";
  if ([51, 53, 55, 56, 57].includes(code)) return "Motregen";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Regen";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Sneeuw";
  if ([95, 96, 99].includes(code)) return "Onweerskans";
  return "Wisselvallig";
}

function decodeXmlEntities(text) {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

async function fetchJsonOrThrow(url, options = {}, errorLabel = "Request failed") {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`${errorLabel}: ${response.status}`);
  }

  return response.json();
}

function extractTag(block, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(pattern);
  return match ? decodeXmlEntities(match[1]) : null;
}

function extractImageUrl(block) {
  const mediaContent = block.match(/<media:content[^>]*url="([^"]+)"/i);
  if (mediaContent) return mediaContent[1];

  const mediaThumbnail = block.match(/<media:thumbnail[^>]*url="([^"]+)"/i);
  if (mediaThumbnail) return mediaThumbnail[1];

  const enclosure = block.match(/<enclosure[^>]*url="([^"]+)"/i);
  if (enclosure) return enclosure[1];

  const imageInDescription = block.match(/<img[^>]+src="([^"]+)"/i);
  if (imageInDescription) return imageInDescription[1];

  return null;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractArticleBody(block) {
  const content = extractTag(block, "content:encoded");
  if (content) {
    return stripHtml(content);
  }

  const description = extractTag(block, "description");
  return description ? stripHtml(description) : "";
}

function parseNosFeed(xml) {
  return parseRssFeed(xml, "NOS Nieuws", "https://nos.nl/");
}

function extractFeedTitle(xml, fallback) {
  return extractTag(xml, "title") || fallback;
}

function parseRssFeed(xml, defaultSource, defaultLink) {
  const itemMatches = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)];
  return itemMatches.map((match) => {
    const block = match[0];
    return {
      title: extractTag(block, "title") || "Nieuwsitem",
      source: defaultSource,
      link: extractTag(block, "link") || defaultLink,
      image: extractImageUrl(block),
      publishedAt: extractTag(block, "pubDate") || "",
      body: extractArticleBody(block)
    };
  });
}

function toBeaufort(speedKmh) {
  const thresholds = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  let bft = 0;
  while (bft < thresholds.length && speedKmh >= thresholds[bft]) {
    bft += 1;
  }
  return bft;
}

function pickRemainingDayRain(hourly) {
  const now = new Date();
  const points = [];

  for (let index = 0; index < hourly.time.length; index += 1) {
    const time = new Date(hourly.time[index]);
    if (Number.isNaN(time.getTime())) continue;
    if (time < now) continue;
    if (time.getDate() !== now.getDate() || time.getMonth() !== now.getMonth() || time.getFullYear() !== now.getFullYear()) {
      continue;
    }

    points.push({
      label: time.getHours() === now.getHours() ? "Nu" : `${String(time.getHours()).padStart(2, "0")}:00`,
      value: 0,
      probability: hourly.precipitation_probability[index] ?? 0
    });
  }

  if (points.length === 0) {
    return demoData.weather.rain;
  }

  const step = Math.max(1, Math.floor(points.length / 4));
  const selected = [];

  for (let index = 0; index < points.length && selected.length < 4; index += step) {
    selected.push(points[index]);
  }

  return selected.slice(0, 4);
}

function pickUpcomingRainMinutely(minutely) {
  const now = new Date();
  const points = [];

  for (let index = 0; index < minutely.time.length; index += 1) {
    const time = new Date(minutely.time[index]);
    if (Number.isNaN(time.getTime())) continue;
    if (time < now) continue;

    points.push({
      label: time.getHours() === now.getHours() && time.getMinutes() === now.getMinutes()
        ? "Nu"
        : `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`,
      value: minutely.precipitation[index] ?? minutely.rain?.[index] ?? 0
    });

    if (points.length >= 12) {
      break;
    }
  }

  if (!points.length) {
    return demoData.weather.rain;
  }

  return points;
}

function decodeBuienradarValue(code) {
  const numeric = Number(code);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round((10 ** ((numeric - 109) / 32)) * 100) / 100;
}

function parseBuienradarRainText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const [code, timeLabel] = line.split("|");
    return {
      label: index === 0 ? "Nu" : (timeLabel || "").trim(),
      value: decodeBuienradarValue(code)
    };
  }).filter((point) => point.label);
}

function pickExpectedTemperature(hourly) {
  const now = new Date();
  const todayEntries = [];

  for (let index = 0; index < hourly.time.length; index += 1) {
    const time = new Date(hourly.time[index]);
    if (Number.isNaN(time.getTime())) continue;
    if (time.getDate() !== now.getDate() || time.getMonth() !== now.getMonth() || time.getFullYear() !== now.getFullYear()) {
      continue;
    }

    todayEntries.push({
      time,
      temperature: hourly.temperature_2m[index]
    });
  }

  if (!todayEntries.length) return null;

  const maxEntry = todayEntries.reduce((best, entry) => (
    entry.temperature > best.temperature ? entry : best
  ), todayEntries[0]);

  if (now < maxEntry.time) {
    return {
      value: Math.round(maxEntry.temperature),
      label: "Vandaag max"
    };
  }

  if (now.getHours() < 22) {
    const eveningEntry = todayEntries.find((entry) => entry.time.getHours() === 22)
      || todayEntries[todayEntries.length - 1];
    return {
      value: Math.round(eveningEntry.temperature),
      label: "Vanavond"
    };
  }

  const nightEntries = [];

  for (let index = 0; index < hourly.time.length; index += 1) {
    const time = new Date(hourly.time[index]);
    if (Number.isNaN(time.getTime())) continue;

    const isTonight =
      (time.getDate() === now.getDate() && time.getHours() >= 22) ||
      (time > now && time.getHours() <= 6);

    if (!isTonight) continue;

    nightEntries.push({
      time,
      temperature: hourly.temperature_2m[index]
    });
  }

  if (!nightEntries.length) {
    return {
      value: Math.round(todayEntries[todayEntries.length - 1].temperature),
      label: "Vannacht"
    };
  }

  const minNightEntry = nightEntries.reduce((best, entry) => (
    entry.temperature < best.temperature ? entry : best
  ), nightEntries[0]);

  return {
    value: Math.round(minNightEntry.temperature),
    label: "Vannacht"
  };
}

async function fetchWeatherPayload() {
  const params = new URLSearchParams({
    latitude: config.weatherLatitude,
    longitude: config.weatherLongitude,
    timezone: config.weatherTimezone,
    current: "temperature_2m,weather_code,wind_speed_10m",
    daily: "temperature_2m_max",
    hourly: "temperature_2m,precipitation_probability",
    minutely_15: "precipitation,rain",
    forecast_minutely_15: "12"
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Weather request failed");
  }

  const payload = await response.json();
  const hourly = payload.hourly || { time: [], precipitation_probability: [] };
  const minutely = payload.minutely_15 || { time: [], precipitation: [], rain: [] };
  const rainPoints = pickUpcomingRainMinutely(minutely);
  const dayRainChancePoints = pickRemainingDayRain(hourly);
  const rainChance = Math.max(...dayRainChancePoints.map((point) => point.probability ?? 0), 0);
  const expectedForecast = pickExpectedTemperature(hourly) || {
    value: Math.round(payload.daily?.temperature_2m_max?.[0] ?? demoData.weather.expectedTemperature),
    label: demoData.weather.expectedLabel
  };

  return {
    source: "open-meteo",
    currentTemperature: Math.round(payload.current?.temperature_2m ?? demoData.weather.currentTemperature),
    expectedTemperature: expectedForecast.value,
    expectedLabel: expectedForecast.label,
    summary: `${mapWeatherCode(payload.current?.weather_code)}${rainChance >= 30 ? ", later kans op regen" : ""}`,
    maxTemperature: Math.round(payload.daily?.temperature_2m_max?.[0] ?? demoData.weather.maxTemperature),
    windBft: toBeaufort(payload.current?.wind_speed_10m ?? 0),
    rainChance: Math.round(rainChance),
    rain: rainPoints
  };
}

async function fetchBuienradarRainPayload() {
  const lat = Number(config.weatherLatitude).toFixed(2);
  const lon = Number(config.weatherLongitude).toFixed(2);
  const url = `https://gpsgadget.buienradar.nl/data/raintext?lat=${lat}&lon=${lon}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "PlannerApp/0.1"
    }
  });

  if (!response.ok) {
    throw new Error("Buienradar raintext request failed");
  }

  const text = await response.text();
  const rain = parseBuienradarRainText(text);

  if (!rain.length) {
    throw new Error("No Buienradar rain points parsed");
  }

  return rain;
}

async function fetchNewsPayload() {
  const generalFeedUrl = "https://feeds.nos.nl/nosnieuwsalgemeen";
  const footballFeedUrl = "https://www.voetbalprimeur.nl/feed/news.xml";

  const [generalResponse, footballResponse] = await Promise.all([
    fetch(generalFeedUrl),
    fetch(footballFeedUrl)
  ]);

  if (!generalResponse.ok) {
    throw new Error("News request failed");
  }

  const generalXml = await generalResponse.text();
  const footballXml = footballResponse.ok ? await footballResponse.text() : "";
  const generalItems = parseNosFeed(generalXml);
  const footballItems = footballXml ? parseRssFeed(footballXml, "VoetbalPrimeur", "https://www.voetbalprimeur.nl/") : [];

  if (!generalItems.length) {
    throw new Error("No news items parsed");
  }

  return {
    source: "rss-mixed",
    tabs: {
      general: {
        key: "general",
        title: "Nieuws",
        feedTitle: extractFeedTitle(generalXml, "NOS Nieuws"),
        items: generalItems
      },
      football: {
        key: "football",
        title: "Voetbal",
        feedTitle: footballItems.length ? extractFeedTitle(footballXml, "VoetbalPrimeur") : "VoetbalPrimeur",
        items: footballItems
      }
    }
  };
}

function getTodayDateStrings() {
  const now = new Date();
  return [formatDateKey(now)];
}

function formatDateKey(date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: config.weatherTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatSportsTime(date) {
  return date.toLocaleTimeString("nl-NL", {
    timeZone: config.weatherTimezone,
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getDateRangeStrings(daysAhead) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = [];

  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    dates.push(formatDateKey(date));
  }

  return dates;
}

function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function formatWeekdayMonthDay(date) {
  return date.toLocaleDateString("nl-NL", {
    timeZone: config.weatherTimezone,
    weekday: "short",
    day: "2-digit",
    month: "short"
  });
}

function parseEventTime(event) {
  const candidates = [event.dateEvent, event.strTimestamp, event.strTime];
  for (const value of candidates) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

const SPORTS_KEYWORDS = {
  tennisLeagues: [
    "roland garros",
    "australian open",
    "wimbledon",
    "us open",
    "atp finals",
    "atp masters 1000",
    "masters 1000",
    "monte-carlo masters",
    "indian wells",
    "miami open",
    "madrid open",
    "italian open",
    "paris masters"
  ],
  footballLeagues: [
    "eredivisie",
    "uefa champions league",
    "champions league",
    "uefa europa league",
    "europa league",
    "uefa conference league",
    "conference league",
    "fifa world cup",
    "world cup",
    "uefa european championship",
    "uefa euro",
    "nations league"
  ],
  footballTeams: [
    "netherlands",
    "nederland",
    "ajax",
    "psv",
    "feyenoord",
    "az",
    "fc twente",
    "twente",
    "utrecht",
    "go ahead eagles",
    "arsenal",
    "barcelona",
    "real madrid",
    "liverpool",
    "manchester city",
    "bayern"
  ]
};

const TENNIS_TOURNAMENT_NAMES = [
  "Roland Garros",
  "Australian Open",
  "Wimbledon",
  "US Open",
  "ATP Finals",
  "Monte-Carlo Masters",
  "Indian Wells",
  "Miami Open",
  "Madrid Open",
  "Italian Open",
  "Paris Masters",
  "Cincinnati Masters",
  "Shanghai Masters",
  "Canadian Open",
  "Dubai Tennis Championships",
  "Qatar Open",
  "Doha",
  "Rome",
  "Monte Carlo"
];

const DUTCH_CLUBS = [
  "ajax",
  "psv",
  "feyenoord",
  "az",
  "fc twente",
  "twente",
  "utrecht",
  "go ahead eagles"
];

const EREDIVISIE_PRIORITY_CLUBS = [
  "ajax",
  "psv",
  "feyenoord",
  "az",
  "fc twente",
  "twente",
  "utrecht"
];

const FOOTBALL_RANKS = {
  "argentina": 1,
  "spain": 2,
  "france": 3,
  "england": 4,
  "brazil": 5,
  "portugal": 6,
  "netherlands": 7,
  "belgium": 8,
  "italy": 9,
  "germany": 10,
  "croatia": 11,
  "morocco": 12,
  "uruguay": 13,
  "colombia": 14,
  "denmark": 15,
  "switzerland": 16,
  "mexico": 17,
  "usa": 18,
  "japan": 19,
  "senegal": 20,
  "ajax": 40,
  "psv": 42,
  "feyenoord": 44,
  "az": 60,
  "arsenal": 20,
  "barcelona": 16,
  "real madrid": 12,
  "liverpool": 18,
  "manchester city": 10,
  "bayern munich": 14,
  "bayern": 14,
  "inter": 22,
  "milan": 24,
  "borussia dortmund": 26,
  "chelsea": 28,
  "atletico madrid": 21,
  "napoli": 25
};

const ATP_RANKS = {
  "jannik sinner": 1,
  "carlos alcaraz": 2,
  "alexander zverev": 3,
  "novak djokovic": 4,
  "ben shelton": 5,
  "felix auger-aliassime": 6,
  "alex de minaur": 7,
  "daniil medvedev": 8,
  "taylor fritz": 9,
  "alexander bublik": 10,
  "lorenzo musetti": 11,
  "jiří lehečka": 12,
  "jiri lehecka": 12,
  "andrey rublev": 13,
  "francisco cobolli": 14,
  "karen khachanov": 15,
  "casper ruud": 16,
  "francisco cerundolo": 26,
  "jakub mensik": 27,
  "stefanos tsitsipas": 79
};

function matchesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesWholePhrase(text, keywords) {
  return keywords.some((keyword) => {
    const pattern = new RegExp(`(^|[^a-z])${escapeRegExp(keyword)}([^a-z]|$)`, "i");
    return pattern.test(text);
  });
}

function normaliseName(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEventNames(event) {
  const title = event.strEvent || "";
  const explicit = [event.strHomeTeam, event.strAwayTeam].filter(Boolean);
  if (explicit.length >= 2) {
    return explicit.map(normaliseName);
  }

  const raw = title.split(/\s+vs\.?\s+|\s+v\s+/i).map((part) => normaliseName(part)).filter(Boolean);
  return raw.slice(0, 2);
}

function isNetherlandsEvent(event) {
  const values = [
    event.strEvent || "",
    event.strHomeTeam || "",
    event.strAwayTeam || ""
  ].map((value) => normaliseName(value));

  return values.some((value) => value.includes("netherlands") || value.includes("nederland"));
}

function getMatchingClubCount(event, clubs) {
  const values = [
    event.strHomeTeam || "",
    event.strAwayTeam || "",
    event.strEvent || ""
  ].map((value) => normaliseName(value));

  return clubs.filter((club) => values.some((value) => value.includes(club))).length;
}

function isAjaxEvent(event) {
  return getMatchingClubCount(event, ["ajax"]) > 0;
}

function getDutchClubCount(event) {
  return getMatchingClubCount(event, DUTCH_CLUBS);
}

function getEredivisiePriorityClubCount(event) {
  return getMatchingClubCount(event, EREDIVISIE_PRIORITY_CLUBS);
}

function competitionWeight(league, sport) {
  if (sport === "tennis") {
    if (league.includes("roland garros") || league.includes("wimbledon") || league.includes("australian open") || league.includes("us open")) return 90;
    if (league.includes("atp finals")) return 80;
    if (league.includes("masters")) return 70;
    return 0;
  }

  if (sport === "football") {
    if (league.includes("world cup") || league.includes("uefa euro") || league.includes("european championship")) return 95;
    if (league.includes("nations league")) return 75;
    if (league.includes("champions league")) return 88;
    if (league.includes("europa league")) return 72;
    if (league.includes("conference league")) return 64;
    if (league.includes("eredivisie")) return 62;
  }

  return 0;
}

function phaseWeight(title, league) {
  const text = `${title} ${league}`;
  if (/\bfinal\b/i.test(text)) return 18;
  if (/semi[- ]final/i.test(text)) return 12;
  if (/quarter[- ]final/i.test(text)) return 8;
  return 0;
}

function rankWeight(rank) {
  if (!rank) return 0;
  if (rank <= 5) return 22;
  if (rank <= 10) return 18;
  if (rank <= 20) return 13;
  if (rank <= 40) return 8;
  if (rank <= 60) return 4;
  return 1;
}

function scoreSportsEvent(event) {
  const league = (event.strLeague || "").toLowerCase();
  const title = `${event.strEvent || ""} ${event.strHomeTeam || ""} ${event.strAwayTeam || ""}`.toLowerCase();
  const sport = (event.strSport || "").toLowerCase();
  const isTennis = sport === "tennis" || league.includes("atp") || league.includes("wimbledon") || league.includes("garros");
  const isFootball = sport === "soccer" || sport === "football";

  if (isTennis) {
    const base = competitionWeight(`${league} ${title}`, "tennis");
    if (!base) {
      return 0;
    }
    const players = parseEventNames(event);
    const ranks = players.map((name) => ATP_RANKS[name]).filter(Boolean).sort((a, b) => a - b);
    const playerScore = ranks.reduce((sum, rank) => sum + rankWeight(rank), 0);
    const bonus = ranks.length >= 2 && ranks[0] <= 10 && ranks[1] <= 10 ? 18 : 0;
    const finalsBonus = /final|semi-final|quarter-final/i.test(title) ? 8 : 0;
    return base + playerScore + phaseWeight(title, league) + bonus + finalsBonus;
  }

  if (isFootball) {
    const base = competitionWeight(league, "football");
    const teams = parseEventNames(event);
    const ranks = teams.map((name) => FOOTBALL_RANKS[name]).filter(Boolean).sort((a, b) => a - b);
    const leagueMatch = base > 0;
    const teamMatch = ranks.length > 0 || matchesWholePhrase(title, SPORTS_KEYWORDS.footballTeams);

    if (!leagueMatch && !teamMatch) {
      return 0;
    }

    if (isNetherlandsEvent(event)) {
      return 200;
    }

    if (league.includes("eredivisie")) {
      if (isAjaxEvent(event)) {
        return 180;
      }

      const priorityClubCount = getEredivisiePriorityClubCount(event);
      if (priorityClubCount >= 2) {
        return 150;
      }

      if (priorityClubCount === 1) {
        return 120;
      }
    }

    if (league.includes("champions league") || league.includes("europa league") || league.includes("conference league")) {
      if (isAjaxEvent(event)) {
        return league.includes("champions league") ? 175 : 170;
      }

      const dutchClubCount = getDutchClubCount(event);
      if (dutchClubCount >= 1) {
        if (league.includes("champions league")) return 165;
        if (league.includes("europa league")) return 155;
        return 145;
      }
    }

    const teamScore = ranks.reduce((sum, rank) => sum + rankWeight(rank), 0);
    const closeTopTie = ranks.length >= 2 && ranks[0] <= 15 && ranks[1] <= 20 ? 14 : 0;
    const mismatchPenalty = ranks.length >= 2 && Math.abs(ranks[0] - ranks[1]) > 40 ? -12 : 0;
    const weakFixturePenalty = base >= 90 && ranks.length >= 2 && (ranks[0] > 20 || ranks[1] > 35) ? -18 : 0;
    const total = base + teamScore + closeTopTie + phaseWeight(title, league) + mismatchPenalty + weakFixturePenalty;

    if (base >= 88) {
      return Math.max(total, base + 6);
    }

    if (base < 70 && teamScore < 10) {
      return leagueMatch ? Math.max(base - 10, 0) : 0;
    }

    return total;
  }

  return 0;
}

function mapSportsEvent(event) {
  const date = parseSportsEventDate(event);
  const league = event.strLeague || event.strSport || "";
  const isTennis = (event.strSport || "").toLowerCase() === "tennis" || league.toLowerCase().includes("atp") || league.toLowerCase().includes("wta");
  const title = isTennis
    ? getTennisMatchTitle(event)
    : event.strEvent || [event.strHomeTeam, event.strAwayTeam].filter(Boolean).join(" vs ") || "Sportevent";
  const meta = isTennis ? getTennisEventLabel(event) : league;
  return {
    startsAt: date ? date.toISOString() : null,
    dateKey: date ? formatDateKey(date) : null,
    time: date
      ? formatSportsTime(date)
      : "--:--",
    title,
    meta,
    type: isTennis ? "tennis" : "football",
    score: scoreSportsEvent(event)
  };
}

async function fetchTheSportsDbDay(dateString, sport) {
  const base = `https://www.thesportsdb.com/api/v1/json/${config.sportsApiKey}`;
  const response = await fetch(`${base}/eventsday.php?d=${dateString}&s=${encodeURIComponent(sport)}`);
  if (!response.ok) {
    throw new Error(`TheSportsDB request failed for ${sport}`);
  }

  return response.json();
}

const SPORTS_TARGETS = [
  { key: "eredivisie", source: "football-data", code: "DED", name: "Eredivisie", sport: "Soccer", type: "football", cadence: "weekly" },
  { key: "champions_league", source: "football-data", code: "CL", name: "UEFA Champions League", sport: "Soccer", type: "football", cadence: "daily" },
  { key: "world_cup", source: "football-data", code: "WC", name: "FIFA World Cup", sport: "Soccer", type: "football", cadence: "daily" },
  { key: "euro", source: "football-data", code: "EC", name: "UEFA European Championships", sport: "Soccer", type: "football", cadence: "daily" },
  { key: "europa_league", source: "thesportsdb", id: "4481", name: "UEFA Europa League", sport: "Soccer", type: "football", cadence: "daily" },
  { key: "conference_league", source: "thesportsdb", id: "5071", name: "UEFA Conference League", sport: "Soccer", type: "football", cadence: "daily" },
  { key: "nations_league", source: "thesportsdb", id: "4490", name: "UEFA Nations League", sport: "Soccer", type: "football", cadence: "daily" },
  { key: "atp", source: "thesportsdb", id: "4464", name: "ATP World Tour", sport: "Tennis", type: "tennis", cadence: "daily" },
  { key: "wta", source: "thesportsdb", id: "4517", name: "WTA Tour", sport: "Tennis", type: "tennis", cadence: "daily" }
];

function getTheSportsDbBaseUrl() {
  return `https://www.thesportsdb.com/api/v1/json/${config.sportsApiKey}`;
}

async function fetchTheSportsDbJson(pathname, params = {}) {
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`${getTheSportsDbBaseUrl()}${pathname}${suffix}`);
  if (!response.ok) {
    throw new Error(`TheSportsDB request failed: ${response.status}`);
  }
  return response.json();
}

function getSplitSeasonLabel(date) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 6 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function resolveSportsDbSeason(target, now = new Date()) {
  if (target.type === "tennis") {
    return String(now.getFullYear());
  }

  if (target.key === "world_cup" || target.key === "euro") {
    return String(now.getFullYear());
  }

  return getSplitSeasonLabel(now);
}

function getFootballDataDateRange(daysAhead) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, daysAhead);
  return {
    dateFrom: formatDateKey(start),
    dateTo: formatDateKey(end)
  };
}

async function fetchFootballDataJson(pathname, params = {}) {
  if (!config.footballDataApiKey) {
    throw new Error("FOOTBALL_DATA_API_KEY ontbreekt");
  }

  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`https://api.football-data.org/v4${pathname}${suffix}`, {
    headers: {
      "X-Auth-Token": config.footballDataApiKey
    }
  });

  if (!response.ok) {
    throw new Error(`football-data.org request failed: ${response.status}`);
  }

  return response.json();
}

function getTargetRefreshWindowHours(target, items) {
  const now = Date.now();
  const upcoming = items
    .map((item) => {
      const startsAt = item.startsAt ? new Date(item.startsAt).getTime() : Number.POSITIVE_INFINITY;
      return startsAt - now;
    })
    .filter((offset) => Number.isFinite(offset) && offset >= -90 * 60 * 1000)
    .sort((a, b) => a - b)[0];

  if (upcoming <= 90 * 60 * 1000) return 0.5;
  if (upcoming <= 6 * 60 * 60 * 1000) return 2;
  if (upcoming <= 24 * 60 * 60 * 1000) return target.type === "tennis" ? 4 : 6;
  if (target.cadence === "daily") return 24;
  return 24 * 7;
}

function normaliseSportsDbEvent(event, target) {
  return {
    ...event,
    idLeague: event.idLeague || target.id || target.code,
    strLeague: event.strLeague || target.name,
    strSport: event.strSport || target.sport
  };
}

function getKnownTennisTournamentName(title) {
  const normalisedTitle = normaliseName(title);

  for (const tournamentName of TENNIS_TOURNAMENT_NAMES) {
    if (normalisedTitle.includes(normaliseName(tournamentName))) {
      return tournamentName;
    }
  }

  return null;
}

function normaliseFootballDataEvent(match, target) {
  const home = match.homeTeam?.shortName || match.homeTeam?.name || "";
  const away = match.awayTeam?.shortName || match.awayTeam?.name || "";
  return {
    idEvent: match.id ? `fd-${match.id}` : null,
    idLeague: target.code,
    strLeague: target.name,
    strSport: "Soccer",
    strEvent: [home, away].filter(Boolean).join(" vs "),
    strHomeTeam: home,
    strAwayTeam: away,
    dateEvent: match.utcDate ? match.utcDate.slice(0, 10) : null,
    strTime: match.utcDate ? match.utcDate.slice(11, 19) : null,
    strTimestamp: match.utcDate || null,
    strStatus: match.status || null,
    strVenue: match.venue || null
  };
}

function getTennisEventLabel(event) {
  const title = event.strEvent || "";
  const tournamentName = getKnownTennisTournamentName(title);

  if (tournamentName) {
    return tournamentName;
  }

  return event.strLeague || "Tennis";
}

function getTennisMatchTitle(event) {
  const title = event.strEvent || "";
  const tournamentName = getKnownTennisTournamentName(title);

  if (tournamentName) {
    const stripped = title
      .replace(new RegExp(`^${escapeRegExp(tournamentName)}\\s*`, "i"), "")
      .trim()
      .replace(/^[-:]\s*/, "")
      .trim();

    if (stripped) {
      return stripped;
    }
  }

  return title || "Tenniswedstrijd";
}

function normaliseSportsTimestampValue(value) {
  if (!value || typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return `${trimmed}Z`;
  }

  return trimmed;
}

function parseSportsEventDate(event) {
  const candidates = [
    normaliseSportsTimestampValue(event.strTimestamp),
    event.strTimeLocal && event.dateEventLocal ? normaliseSportsTimestampValue(`${event.dateEventLocal}T${event.strTimeLocal}`) : null,
    event.strTime && event.dateEvent ? normaliseSportsTimestampValue(`${event.dateEvent}T${event.strTime}`) : null,
    event.dateEventLocal,
    event.dateEvent
  ];

  for (const value of candidates) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function mergeStoredEvents(existingEvents, incomingEvents) {
  const merged = new Map();

  for (const event of existingEvents) {
    const key = event.idEvent || `${event.idLeague}-${event.strEvent}-${event.dateEvent}-${event.strTime || ""}`;
    merged.set(key, event);
  }

  for (const event of incomingEvents) {
    const key = event.idEvent || `${event.idLeague}-${event.strEvent}-${event.dateEvent}-${event.strTime || ""}`;
    merged.set(key, event);
  }

  return [...merged.values()];
}

function pruneStoredEvents(events) {
  const cutoff = addDays(new Date(), -2).getTime();
  return events.filter((event) => {
    const parsed = parseSportsEventDate(event);
    return !parsed || parsed.getTime() >= cutoff;
  });
}

async function fetchSportsDbSeasonEvents(target, season) {
  const payload = await fetchTheSportsDbJson("/eventsseason.php", {
    id: target.id,
    s: season
  });

  return Array.isArray(payload.events)
    ? payload.events.map((event) => normaliseSportsDbEvent(event, target))
    : [];
}

async function fetchSportsDbNextLeagueEvents(target) {
  const payload = await fetchTheSportsDbJson("/eventsnextleague.php", { id: target.id });
  return Array.isArray(payload.events)
    ? payload.events.map((event) => normaliseSportsDbEvent(event, target))
    : [];
}

async function fetchFootballDataCompetitionEvents(target, daysAhead) {
  const range = getFootballDataDateRange(daysAhead);
  const payload = await fetchFootballDataJson(`/competitions/${target.code}/matches`, {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo
  });

  return Array.isArray(payload.matches)
    ? payload.matches.map((match) => normaliseFootballDataEvent(match, target))
    : [];
}

function createEmptySportsStore() {
  return {
    version: 1,
    source: "mixed-sources",
    updatedAt: null,
    targets: {}
  };
}

function getOrCreateTargetStore(store, target, season) {
  if (!store.targets[target.key]) {
    store.targets[target.key] = {
      id: target.id || target.code,
      name: target.name,
      source: target.source,
      sport: target.sport,
      type: target.type,
      season,
      lastFullSyncAt: null,
      lastNearSyncAt: null,
      lastFullSyncCount: 0,
      lastNearSyncCount: 0,
      lastError: null,
      events: []
    };
  }

  const entry = store.targets[target.key];
  const targetId = target.id || target.code;
  const targetSource = target.source;

  if (entry.id !== targetId || entry.source !== targetSource) {
    entry.id = targetId;
    entry.source = targetSource;
    entry.name = target.name;
    entry.sport = target.sport;
    entry.type = target.type;
    entry.season = season;
    entry.lastFullSyncAt = null;
    entry.lastNearSyncAt = null;
    entry.lastFullSyncCount = 0;
    entry.lastNearSyncCount = 0;
    entry.lastError = null;
    entry.events = [];
  }

  return entry;
}

async function syncSportsDbTarget(store, target, options = {}) {
  const season = resolveSportsDbSeason(target);
  const entry = getOrCreateTargetStore(store, target, season);

  if (entry.season !== season) {
    entry.season = season;
    entry.events = [];
    entry.lastFullSyncAt = null;
    entry.lastNearSyncAt = null;
  }

  const now = new Date();
  const nowMs = now.getTime();
  const refreshHours = getTargetRefreshWindowHours(target, entry.events.map(mapSportsEvent));
  const fullSyncDue = !entry.lastFullSyncAt || (nowMs - Date.parse(entry.lastFullSyncAt)) >= (7 * 24 * 60 * 60 * 1000);
  const nearSyncDue = !entry.lastNearSyncAt || (nowMs - Date.parse(entry.lastNearSyncAt)) >= (refreshHours * 60 * 60 * 1000);

  if (options.forceFull || fullSyncDue) {
    const events = await fetchSportsDbSeasonEvents(target, season);
    entry.events = pruneStoredEvents(events);
    entry.lastFullSyncAt = now.toISOString();
    entry.lastFullSyncCount = events.length;
    entry.lastError = null;
  }

  if (options.forceNear || nearSyncDue) {
    const events = await fetchSportsDbNextLeagueEvents(target);
    entry.events = pruneStoredEvents(mergeStoredEvents(entry.events, events));
    entry.lastNearSyncAt = now.toISOString();
    entry.lastNearSyncCount = events.length;
    entry.lastError = null;
  }
}

async function syncFootballDataTarget(store, target, options = {}) {
  const season = String(new Date().getFullYear());
  const entry = getOrCreateTargetStore(store, target, season);

  if (entry.season !== season) {
    entry.season = season;
    entry.events = [];
    entry.lastFullSyncAt = null;
    entry.lastNearSyncAt = null;
    entry.lastFullSyncCount = 0;
    entry.lastNearSyncCount = 0;
    entry.lastError = null;
  }

  const now = new Date();
  const nowMs = now.getTime();
  const refreshHours = getTargetRefreshWindowHours(target, entry.events.map(mapSportsEvent));
  const fullSyncDue = !entry.lastFullSyncAt || (nowMs - Date.parse(entry.lastFullSyncAt)) >= (7 * 24 * 60 * 60 * 1000);
  const nearSyncDue = !entry.lastNearSyncAt || (nowMs - Date.parse(entry.lastNearSyncAt)) >= (refreshHours * 60 * 60 * 1000);

  if (options.forceFull || fullSyncDue) {
    const events = await fetchFootballDataCompetitionEvents(target, 45);
    entry.events = pruneStoredEvents(events);
    entry.lastFullSyncAt = now.toISOString();
    entry.lastFullSyncCount = events.length;
    entry.lastError = null;
  }

  if (options.forceNear || nearSyncDue) {
    const events = await fetchFootballDataCompetitionEvents(target, 7);
    entry.events = pruneStoredEvents(mergeStoredEvents(entry.events, events));
    entry.lastNearSyncAt = now.toISOString();
    entry.lastNearSyncCount = events.length;
    entry.lastError = null;
  }
}

async function ensureSportsStoreFresh() {
  const store = sportsCache.store || readSportsStore() || createEmptySportsStore();

  for (const target of SPORTS_TARGETS) {
    const entry = getOrCreateTargetStore(store, target, target.source === "football-data" ? String(new Date().getFullYear()) : resolveSportsDbSeason(target));

    try {
      if (target.source === "football-data") {
        await syncFootballDataTarget(store, target);
      } else {
        await syncSportsDbTarget(store, target);
      }
    } catch (error) {
      entry.lastError = error.message;
    }
  }

  store.updatedAt = new Date().toISOString();
  writeSportsStore(store);
  sportsCache.store = store;
  return store;
}

function getStoredSportsEvents(store) {
  return Object.values(store.targets || {})
    .filter((target) => !target.lastError)
    .flatMap((target) => Array.isArray(target.events) ? target.events : [])
    .map(mapSportsEvent);
}

function getSportsPayloadCacheMs(store) {
  let shortestWindowHours = 6;

  for (const target of SPORTS_TARGETS) {
    const entry = store.targets?.[target.key];
    const items = Array.isArray(entry?.events) ? entry.events.map(mapSportsEvent) : [];
    shortestWindowHours = Math.min(shortestWindowHours, getTargetRefreshWindowHours(target, items));
  }

  return Math.max(15 * 60 * 1000, shortestWindowHours * 60 * 60 * 1000);
}

function getTennisPhotoCacheStore() {
  if (!tennisPhotoCache) {
    tennisPhotoCache = readTennisPhotoCache();
  }

  if (!tennisPhotoCache.players) {
    tennisPhotoCache.players = {};
  }

  return tennisPhotoCache;
}

function normalisePlayerLookupName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCachedTennisPhoto(name) {
  const cache = getTennisPhotoCacheStore();
  const key = normalisePlayerLookupName(name);
  const entry = cache.players[key];

  if (!entry?.checkedAt || entry.strategy !== "commons-category-v1") {
    return null;
  }

  const ageMs = Date.now() - Date.parse(entry.checkedAt);
  if (Number.isNaN(ageMs) || ageMs > (14 * 24 * 60 * 60 * 1000)) {
    return null;
  }

  return entry;
}

function setCachedTennisPhoto(name, payload) {
  const cache = getTennisPhotoCacheStore();
  const key = normalisePlayerLookupName(name);
  cache.players[key] = {
    strategy: "commons-category-v1",
    ...payload,
    checkedAt: new Date().toISOString()
  };
  writeTennisPhotoCache(cache);
}

async function searchWikidataPlayer(name) {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    format: "json",
    language: "en",
    uselang: "en",
    type: "item",
    limit: "5",
    search: name
  });

  const payload = await fetchJsonOrThrow(`https://www.wikidata.org/w/api.php?${params.toString()}`, {}, "Wikidata search failed");
  const results = Array.isArray(payload.search) ? payload.search : [];

  const preferred = results.find((item) => /tennis player/i.test(item.description || ""));
  return preferred || results[0] || null;
}

async function fetchWikidataImageFile(entityId) {
  const params = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    ids: entityId,
    props: "claims"
  });

  const payload = await fetchJsonOrThrow(`https://www.wikidata.org/w/api.php?${params.toString()}`, {}, "Wikidata entity failed");
  const entity = payload.entities?.[entityId];
  const imageClaim = entity?.claims?.P18?.[0];
  return imageClaim?.mainsnak?.datavalue?.value || null;
}

async function fetchWikidataMediaClaims(entityId) {
  const params = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    ids: entityId,
    props: "claims"
  });

  const payload = await fetchJsonOrThrow(`https://www.wikidata.org/w/api.php?${params.toString()}`, {}, "Wikidata entity failed");
  const entity = payload.entities?.[entityId];
  const imageClaim = entity?.claims?.P18?.[0];
  const commonsCategoryClaim = entity?.claims?.P373?.[0];

  return {
    imageFile: imageClaim?.mainsnak?.datavalue?.value || null,
    commonsCategory: commonsCategoryClaim?.mainsnak?.datavalue?.value || null
  };
}

async function fetchCommonsThumbnail(fileName, width = 160) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: String(width),
    titles: `File:${fileName}`
  });

  const payload = await fetchJsonOrThrow(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {}, "Commons image lookup failed");
  const pages = payload.query?.pages || {};
  const firstPage = Object.values(pages)[0];
  const imageInfo = Array.isArray(firstPage?.imageinfo) ? firstPage.imageinfo[0] : null;
  return imageInfo?.thumburl || imageInfo?.url || null;
}

async function fetchCommonsCategoryFiles(categoryName, limit = 12) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    list: "categorymembers",
    cmtitle: `Category:${categoryName}`,
    cmtype: "file",
    cmlimit: String(limit)
  });

  const payload = await fetchJsonOrThrow(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {}, "Commons category lookup failed");
  return Array.isArray(payload.query?.categorymembers) ? payload.query.categorymembers : [];
}

async function fetchCommonsImagesInfo(fileTitles, width = 160) {
  if (!fileTitles.length) {
    return [];
  }

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url|timestamp",
    iiurlwidth: String(width),
    titles: fileTitles.join("|")
  });

  const payload = await fetchJsonOrThrow(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {}, "Commons batch lookup failed");
  const pages = Object.values(payload.query?.pages || {});

  return pages
    .map((page) => {
      const imageInfo = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
      return {
        title: page?.title || "",
        thumburl: imageInfo?.thumburl || imageInfo?.url || null,
        timestamp: imageInfo?.timestamp || null
      };
    })
    .filter((item) => item.thumburl);
}

function scoreCommonsPortraitCandidate(item, playerName) {
  const title = String(item.title || "").toLowerCase();
  const player = String(playerName || "").toLowerCase();
  let score = 0;

  if (title.includes(player)) score += 8;
  if (/\b(2026|2025|2024|2023)\b/.test(title)) score += 5;
  if (/\b(open|championships|masters|wimbledon|roland garros|us open|australian open)\b/.test(title)) score += 3;
  if (/\b(cropped|headshot|portrait)\b/.test(title)) score += 4;
  if (/\b(signature|autograph|logo|draw|map)\b/.test(title)) score -= 8;
  if (item.timestamp) score += Date.parse(item.timestamp) / 1e13;

  return score;
}

async function fetchRecentCommonsPortrait(name, commonsCategory) {
  if (!commonsCategory) {
    return null;
  }

  const members = await fetchCommonsCategoryFiles(commonsCategory, 16);
  const files = members
    .map((item) => item.title)
    .filter((title) => /^File:/i.test(title));

  if (!files.length) {
    return null;
  }

  const images = await fetchCommonsImagesInfo(files, 160);
  if (!images.length) {
    return null;
  }

  const best = images
    .map((item) => ({ ...item, score: scoreCommonsPortraitCandidate(item, name) }))
    .sort((a, b) => b.score - a.score)[0];

  return best?.thumburl || null;
}

async function fetchTennisPlayerPhoto(name) {
  const cached = getCachedTennisPhoto(name);
  if (cached) {
    return cached;
  }

  const fallback = { name, imageUrl: null, source: "wikimedia", found: false };

  try {
    const match = await searchWikidataPlayer(name);
    if (!match?.id) {
      setCachedTennisPhoto(name, fallback);
      return fallback;
    }

    const media = await fetchWikidataMediaClaims(match.id);
    const recentCategoryImage = await fetchRecentCommonsPortrait(name, media.commonsCategory);
    const imageUrl = recentCategoryImage || (media.imageFile ? await fetchCommonsThumbnail(media.imageFile, 160) : null);

    if (!imageUrl) {
      setCachedTennisPhoto(name, fallback);
      return fallback;
    }

    const result = {
      name,
      imageUrl,
      source: "wikimedia",
      found: true
    };
    setCachedTennisPhoto(name, result);
    return result;
  } catch {
    setCachedTennisPhoto(name, fallback);
    return fallback;
  }
}

async function fetchTennisPlayerPhotos(names) {
  const uniqueNames = [...new Set(
    names
      .map((name) => String(name || "").trim())
      .filter(Boolean)
  )];

  const entries = await Promise.all(uniqueNames.map((name) => fetchTennisPlayerPhoto(name)));
  return Object.fromEntries(entries.map((entry) => [entry.name, entry]));
}

function getSportsDebugSamples(events) {
  return events
    .map((event) => ({
      idEvent: event.idEvent || null,
      dateEvent: event.dateEvent || null,
      strTime: event.strTime || null,
      strTimestamp: event.strTimestamp || null,
      strEvent: event.strEvent || null,
      strHomeTeam: event.strHomeTeam || null,
      strAwayTeam: event.strAwayTeam || null,
      strLeague: event.strLeague || null
    }))
    .slice(0, 3);
}

async function fetchSportsDebugPayload() {
  const store = await ensureSportsStoreFresh();
  const groupedTargets = Object.entries(store.targets || {}).map(([key, value]) => ({
    key,
    name: value.name,
    source: value.source || null,
    season: value.season,
    lastFullSyncAt: value.lastFullSyncAt,
    lastNearSyncAt: value.lastNearSyncAt,
    lastFullSyncCount: value.lastFullSyncCount || 0,
    lastNearSyncCount: value.lastNearSyncCount || 0,
    lastError: value.lastError || null,
    eventCount: Array.isArray(value.events) ? value.events.length : 0,
    samples: getSportsDebugSamples(Array.isArray(value.events) ? value.events : [])
  }));

  return {
    source: "mixed-sources",
    cachePath: sportsCachePath,
    updatedAt: store.updatedAt,
    payloadCacheMs: getSportsPayloadCacheMs(store),
    footballData: groupedTargets.filter((target) => target.source === "football-data"),
    theSportsDb: groupedTargets.filter((target) => target.source === "thesportsdb")
  };
}

function formatUpcomingSportsItem(event, todayKeys) {
  if (!event.startsAt) {
    return event;
  }

  const start = new Date(event.startsAt);
  const isTomorrow = todayKeys.has(formatDateKey(addDays(start, -1)));
  const dateLabel = isTomorrow ? "Morgen" : formatWeekdayMonthDay(start);
  const timeLabel = formatSportsTime(start);

  return {
    ...event,
    time: dateLabel,
    meta: event.meta ? `${event.meta} • ${timeLabel}` : timeLabel
  };
}

function compareSportsByRelevance(a, b) {
  if (a.score !== b.score) {
    return b.score - a.score;
  }

  if (a.startsAt && b.startsAt && a.startsAt !== b.startsAt) {
    return a.startsAt.localeCompare(b.startsAt);
  }

  return a.title.localeCompare(b.title);
}

async function fetchSportsPayload() {
  if (sportsCache.payload && sportsCache.expiresAt > Date.now()) {
    return sportsCache.payload;
  }

  const store = await ensureSportsStoreFresh();
  const now = new Date();
  const upcomingCutoff = addDays(now, 30).getTime();
  const scored = getStoredSportsEvents(store)
    .filter((event) => event.score > 0)
    .filter((event) => {
      if (!event.startsAt) {
        return true;
      }

      const startsAtMs = Date.parse(event.startsAt);
      return Number.isNaN(startsAtMs) || startsAtMs <= upcomingCutoff;
    })
    .sort(compareSportsByRelevance);

  const todayKeys = new Set(getTodayDateStrings());
  const todayItems = scored
    .filter((event) => event.dateKey && todayKeys.has(event.dateKey))
    .sort((a, b) => b.score - a.score || a.time.localeCompare(b.time))
    .slice(0, 12);

  const upcomingItems = scored
    .filter((event) => !event.dateKey || !todayKeys.has(event.dateKey))
    .sort(compareSportsByRelevance)
    .map((event) => formatUpcomingSportsItem(event, todayKeys))
    .slice(0, 12);

  const payload = {
    source: "mixed-sources",
    todayItems,
    upcomingItems
  };

  sportsCache = {
    expiresAt: Date.now() + getSportsPayloadCacheMs(store),
    payload,
    store
  };

  return payload;
}

function buildGoogleAuthUrl() {
  googleAuthState = crypto.randomBytes(18).toString("hex");

  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    state: googleAuthState
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeGoogleCode(code) {
  const params = new URLSearchParams({
    code,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: config.googleRedirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google token exchange failed: ${detail}`);
  }

  return response.json();
}

async function refreshGoogleAccessToken(tokens) {
  if (!tokens.refresh_token) {
    throw new Error("No Google refresh token available");
  }

  const params = new URLSearchParams({
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    refresh_token: tokens.refresh_token,
    grant_type: "refresh_token"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google token refresh failed: ${detail}`);
  }

  const refreshed = await response.json();
  const merged = {
    ...tokens,
    ...refreshed,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + ((refreshed.expires_in || 3600) * 1000)
  };

  writeGoogleTokens(merged);
  return merged;
}

async function getValidGoogleTokens() {
  const tokens = readGoogleTokens();
  if (!tokens) return null;

  if (!tokens.expires_at || tokens.expires_at - Date.now() < 60_000) {
    return refreshGoogleAccessToken(tokens);
  }

  return tokens;
}

async function fetchGoogleAccountEmail(accessToken) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return payload.email || null;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function endOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

function mapGoogleEvent(event) {
  const start = event.start?.dateTime || event.start?.date || null;
  const end = event.end?.dateTime || event.end?.date || null;

  return {
    id: event.id,
    title: event.summary || "Zonder titel",
    start,
    end
  };
}

async function fetchGoogleCalendarDay(calendarId, ownerLabel) {
  const tokens = await getValidGoogleTokens();
  if (!tokens?.access_token) {
    return { owner: ownerLabel, items: [] };
  }

  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "8",
    timeMin: startOfToday().toISOString(),
    timeMax: endOfToday().toISOString()
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Calendar fetch failed: ${detail}`);
  }

  const payload = await response.json();
  return {
    owner: ownerLabel,
    items: Array.isArray(payload.items) ? payload.items.map(mapGoogleEvent) : []
  };
}

async function getCalendarPayload(ownerKey) {
  if (!isGoogleConfigured()) {
    return { ...demoData.calendar[ownerKey], source: "demo", reason: "not_configured" };
  }

  const status = getGoogleStatus();
  if (!status.connected) {
    return { ...demoData.calendar[ownerKey], source: "demo", reason: "not_connected" };
  }

  const calendarId = ownerKey === "me"
    ? config.googleCalendarMeId
    : ownerKey === "partner"
      ? config.googleCalendarPartnerId
      : config.googleCalendarSharedId;
  const ownerLabel = ownerKey === "me"
    ? demoData.calendar.me.owner
    : ownerKey === "partner"
      ? demoData.calendar.partner.owner
      : demoData.calendar.shared.owner;
  const liveData = await fetchGoogleCalendarDay(calendarId, ownerLabel);
  return { ...liveData, source: "google" };
}

async function handleGoogleAuthStart(response) {
  if (!isGoogleConfigured()) {
    redirect(response, "/?google=config");
    return;
  }

  redirect(response, buildGoogleAuthUrl());
}

async function handleGoogleAuthCallback(url, response) {
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    redirect(response, `/?google=error&reason=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state || state !== googleAuthState) {
    redirect(response, "/?google=invalid");
    return;
  }

  googleAuthState = null;

  const tokenPayload = await exchangeGoogleCode(code);
  const accountEmail = await fetchGoogleAccountEmail(tokenPayload.access_token);
  writeGoogleTokens({
    ...tokenPayload,
    expires_at: Date.now() + ((tokenPayload.expires_in || 3600) * 1000),
    account_email: accountEmail
  });

  redirect(response, "/?google=connected");
}

async function handleApi(request, response, pathname, url) {
  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      mode: "local",
      message: "Local planner server is running."
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/calendar/status") {
    sendJson(response, 200, getGoogleStatus());
    return true;
  }

  if (request.method === "GET" && pathname === "/api/calendar/me") {
    sendJson(response, 200, await getCalendarPayload("me"));
    return true;
  }

  if (request.method === "GET" && pathname === "/api/calendar/partner") {
    sendJson(response, 200, await getCalendarPayload("partner"));
    return true;
  }

  if (request.method === "GET" && pathname === "/api/calendar/shared") {
    sendJson(response, 200, await getCalendarPayload("shared"));
    return true;
  }

  if (request.method === "GET" && pathname === "/api/weather") {
    try {
      const weather = await fetchWeatherPayload();
      try {
        weather.rain = await fetchBuienradarRainPayload();
        weather.rainSource = "buienradar-raintext";
      } catch {
        weather.rainSource = "open-meteo";
      }
      sendJson(response, 200, weather);
    } catch {
      sendJson(response, 200, { ...demoData.weather, source: "demo" });
    }
    return true;
  }

  if (request.method === "GET" && pathname === "/api/news") {
    try {
      sendJson(response, 200, await fetchNewsPayload());
    } catch {
      sendJson(response, 200, { source: "demo", tabs: demoData.news });
    }
    return true;
  }

  if (request.method === "GET" && pathname === "/api/sports") {
    try {
      sendJson(response, 200, await fetchSportsPayload());
    } catch {
      sendJson(response, 200, { source: "demo", todayItems: demoData.sports.todayItems, upcomingItems: demoData.sports.upcomingItems });
    }
    return true;
  }

  if (request.method === "GET" && pathname === "/api/sports-debug") {
    try {
      sendPrettyJson(response, 200, await fetchSportsDebugPayload());
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
    return true;
  }

  if (request.method === "GET" && pathname === "/api/tennis-photos") {
    try {
      const names = url.searchParams.getAll("name");
      sendJson(response, 200, {
        source: "wikimedia",
        players: await fetchTennisPlayerPhotos(names)
      });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message, players: {} });
    }
    return true;
  }

  if (request.method === "GET" && pathname === "/api/home/lights") {
    try {
      if (!isHomeAssistantConfigured()) {
        sendJson(response, 200, {
          source: "demo",
          entities: demoData.home.lights.map((light) => ({ ...light, domain: getEntityDomain(light.entityId) })),
          rooms: groupHomeLightsByRoom(demoData.home.lights)
        });
      } else {
        sendJson(response, 200, await fetchHomeAssistantLightsPayload());
      }
    } catch (error) {
      sendJson(response, 200, {
        source: "demo",
        error: error.message,
        entities: demoData.home.lights.map((light) => ({ ...light, domain: getEntityDomain(light.entityId) })),
        rooms: groupHomeLightsByRoom(demoData.home.lights)
      });
    }
    return true;
  }

  if (request.method === "POST" && pathname === "/api/home/toggle") {
    const body = await readJsonBody(request);
    try {
      const entityIds = Array.isArray(body.entityIds)
        ? body.entityIds.filter(Boolean)
        : body.entityId
          ? [body.entityId]
          : [];

      if (isHomeAssistantConfigured() && entityIds.length) {
        await setHomeAssistantEntitiesState(entityIds, Boolean(body.desiredState));
        sendJson(response, 200, { ok: true, action: "toggle", entityIds, mode: "home-assistant" });
      } else {
        sendJson(response, 200, { ok: true, action: "toggle", entityIds, mode: "demo" });
      }
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
    return true;
  }

  if (request.method === "POST" && pathname === "/api/home/dim") {
    const body = await readJsonBody(request);
    try {
      const entityIds = Array.isArray(body.entityIds)
        ? body.entityIds.filter(Boolean)
        : body.entityId
          ? [body.entityId]
          : [];

      if (isHomeAssistantConfigured() && entityIds.length) {
        await dimHomeAssistantLight(entityIds, body.brightness);
        sendJson(response, 200, {
          ok: true,
          action: "dim",
          entityIds,
          brightness: body.brightness ?? null,
          mode: "home-assistant"
        });
      } else {
        sendJson(response, 200, {
          ok: true,
          action: "dim",
          entityIds,
          brightness: body.brightness ?? null,
          mode: "demo"
        });
      }
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
    return true;
  }

  if (request.method === "POST" && pathname === "/api/calendar/disconnect") {
    try {
      fs.unlinkSync(googleTokenPath);
    } catch {}

    sendJson(response, 200, { ok: true });
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/auth/google/start") {
      await handleGoogleAuthStart(response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/auth/google/callback") {
      await handleGoogleAuthCallback(url, response);
      return;
    }

    const handled = await handleApi(request, response, url.pathname, url);
    if (handled) return;

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, {
      error: "Unexpected server error",
      detail: error.message
    });
  }
});

server.listen(port, host, () => {
  console.log(`Planner app available at http://${host}:${port}`);
});
