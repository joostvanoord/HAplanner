const clock = document.getElementById("clock");
const toast = document.getElementById("toast");
const widgetPages = document.querySelectorAll(".widget-page");
const widgetPagesContainer = document.querySelector(".widget-pages");
const widgetDots = document.querySelectorAll(".dot");
const googleStatus = document.getElementById("google-status");
const googleConnectButton = document.getElementById("google-connect-button");
const integrationStrip = document.querySelector(".integration-strip");
const sportsList = document.getElementById("sports-list");
const sportsSummary = document.getElementById("sports-summary");
const sportsTabs = document.querySelectorAll(".sports-tab");
const weatherTemp = document.getElementById("weather-temp");
const weatherExpectedTemp = document.getElementById("weather-expected-temp");
const weatherExpectedNote = document.getElementById("weather-expected-note");
const weatherSummary = document.getElementById("weather-summary");
const weatherStats = document.getElementById("weather-stats");
const roomBlocks = document.querySelector(".room-blocks");
const homeSettingsButton = document.getElementById("home-settings-button");
const homeSettingsModal = document.getElementById("home-settings-modal");
const homeSettingsClose = document.getElementById("home-settings-close");
const settingsDeviceList = document.getElementById("settings-device-list");
const homeGroupButton = document.getElementById("home-group-button");
const homeGroupModal = document.getElementById("home-group-modal");
const homeGroupClose = document.getElementById("home-group-close");
const homeGroupCancel = document.getElementById("home-group-cancel");
const homeGroupSave = document.getElementById("home-group-save");
const groupDeviceList = document.getElementById("group-device-list");
const groupNameInput = document.getElementById("group-name-input");
const rainArea = document.getElementById("rain-area");
const rainLine = document.getElementById("rain-line");
const rainTimeLabels = document.getElementById("rain-time-labels");
const newsFeedLabel = document.getElementById("news-feed-label");
const newsList = document.getElementById("news-list");
const footballFeedLabel = document.getElementById("football-feed-label");
const footballNewsList = document.getElementById("football-news-list");
const articleModal = document.getElementById("article-modal");
const articleModalClose = document.getElementById("article-modal-close");
const articleModalTitle = document.getElementById("article-modal-title");
const articleModalSource = document.getElementById("article-modal-source");
const articleFrame = document.getElementById("article-frame");
const articleModalHeader = document.getElementById("article-modal-header");
const articleFrameWrap = document.getElementById("article-frame-wrap");
const nosArticleView = document.getElementById("nos-article-view");
const nosArticleClose = document.getElementById("nos-article-close");
const nosArticleDate = document.getElementById("nos-article-date");
const nosArticleTitle = document.getElementById("nos-article-title");
const nosArticleImageWrap = document.getElementById("nos-article-image-wrap");
const nosArticleImage = document.getElementById("nos-article-image");
const nosArticleCopy = document.getElementById("nos-article-copy");

const agendaTargets = {
  me: {
    title: document.getElementById("agenda-joost-title"),
    list: document.getElementById("agenda-joost-list"),
    fallbackOwner: "Joost"
  },
  partner: {
    title: document.getElementById("agenda-partner-title"),
    list: document.getElementById("agenda-partner-list"),
    fallbackOwner: "Nadine"
  },
  shared: {
    title: document.getElementById("agenda-shared-title"),
    list: document.getElementById("agenda-shared-list"),
    fallbackOwner: "Samen"
  }
};

const calendarState = {
  me: null,
  partner: null,
  shared: null
};

const sportsState = {
  view: "today",
  payload: null
};

const newsState = { payload: null };

const homeState = {
  rooms: [],
  allRooms: [],
  entities: []
};

const HOME_SELECTION_KEY = "planner.homeSelection";
const HOME_GROUP_KEY = "planner.homeGroups";
const HOME_ROOM_ORDER = ["Living Room", "Kitchen", "Bedroom", "Office"];
const pendingHomeEntityIds = new Set();
const pendingHomeExpectations = new Map();
const WIDGET_ORDER = ["weather", "news", "football-news"];
let activeWidget = "weather";

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

document.addEventListener("gesturestart", (event) => {
  event.preventDefault();
});

document.addEventListener("gesturechange", (event) => {
  event.preventDefault();
});

document.addEventListener("touchmove", (event) => {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, { passive: false });

document.addEventListener("wheel", (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
  }
}, { passive: false });

document.addEventListener("keydown", (event) => {
  if (!event.ctrlKey) return;

  const blockedKeys = ["+", "-", "=", "_", "0"];
  const blockedCodes = ["NumpadAdd", "NumpadSubtract", "Digit0", "Equal", "Minus"];

  if (blockedKeys.includes(event.key) || blockedCodes.includes(event.code)) {
    event.preventDefault();
  }
});

function setWidget(name) {
  activeWidget = name;
  widgetPages.forEach((page) => page.classList.toggle("is-active", page.dataset.widget === name));
  widgetDots.forEach((dot) => dot.classList.toggle("is-active", dot.dataset.target === name));
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderAgenda(key, payload) {
  const target = agendaTargets[key];
  if (!target) return;

  const owner = payload.owner || target.fallbackOwner;
  target.title.textContent = `Agenda ${owner}`;

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    target.list.innerHTML = `<p class="agenda-empty">Geen afspraken meer voor vandaag.</p>`;
    return;
  }

  target.list.innerHTML = payload.items.map((item) => `
    <div class="agenda-item">
      <span class="agenda-time">${formatTime(item.start)}</span>
      <span class="agenda-title">${item.title}</span>
    </div>
  `).join("");
}

function renderCalendarStatus(status) {
  if (!googleStatus || !googleConnectButton || !integrationStrip) return;

  googleStatus.classList.add("is-hidden");

  if (status.connected) {
    googleConnectButton.classList.add("is-hidden");
    integrationStrip.classList.add("is-hidden");
    return;
  }

  integrationStrip.classList.remove("is-hidden");
  googleConnectButton.classList.remove("is-hidden");

  if (!status.configured) {
    googleConnectButton.textContent = "Eerst instellen";
    return;
  }

  googleConnectButton.textContent = "Google koppelen";
}

async function loadCalendarStatus() {
  const response = await fetch("/api/calendar/status", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Calendar status kon niet worden opgehaald");
  }

  const status = await response.json();
  renderCalendarStatus(status);
  return status;
}

async function loadAgenda(key) {
  const response = await fetch(`/api/calendar/${key}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Agenda ${key} kon niet worden opgehaald`);
  }

  const payload = await response.json();
  calendarState[key] = payload;
  renderAgenda(key, payload);
  return payload;
}

async function bootCalendar() {
  try {
    const status = await loadCalendarStatus();

    await Promise.all([
      loadAgenda("me"),
      loadAgenda("partner"),
      loadAgenda("shared")
    ]);

    if (!status.connected && status.configured) {
      showToast("Google Calendar kan nu gekoppeld worden.");
    }
  } catch (error) {
    renderCalendarStatus({ configured: false, connected: false });
    showToast(error.message);
  }
}

function renderWeather(payload) {
  if (weatherTemp) {
    weatherTemp.textContent = `${payload.currentTemperature}°`;
  }

  if (weatherExpectedTemp) {
    weatherExpectedTemp.textContent = `${payload.expectedTemperature}°`;
  }

  if (weatherExpectedNote) {
    weatherExpectedNote.textContent = payload.expectedLabel || "Later vandaag";
  }

  if (weatherSummary) {
    weatherSummary.textContent = payload.summary;
  }

  if (weatherStats) {
    weatherStats.innerHTML = `
      <span class="weather-stat-pill">Max ${payload.maxTemperature}°</span>
      <span class="weather-stat-pill">Wind ${payload.windBft} Bft</span>
      <span class="weather-stat-pill">Regen ${payload.rainChance}%</span>
    `;
  }

  if (rainTimeLabels && Array.isArray(payload.rain)) {
    const preferredIndexes = [0, Math.floor((payload.rain.length - 1) / 3), Math.floor(((payload.rain.length - 1) * 2) / 3), payload.rain.length - 1];
    const labels = [...new Set(preferredIndexes)]
      .filter((index) => index >= 0 && payload.rain[index])
      .map((index) => payload.rain[index]);
    rainTimeLabels.innerHTML = labels.map((point) => `<span>${point.label}</span>`).join("");
  }

  if (rainArea && Array.isArray(payload.rain) && payload.rain.length > 0) {
    const maxValue = Math.max(...payload.rain.map((point) => point.value), 1);
    const count = payload.rain.length - 1 || 1;
    const chartPoints = payload.rain.map((point, index) => {
      const x = (index / count) * 100;
      const normalized = maxValue === 0 ? 0 : point.value / maxValue;
      const y = point.value <= 0 ? 88 : 84 - (normalized * 52);
      return { x, y, value: point.value };
    });

    const positiveIndexes = chartPoints
      .map((point, index) => (point.value > 0 ? index : -1))
      .filter((index) => index >= 0);

    const segments = [];

    if (positiveIndexes.length) {
      let segmentStart = positiveIndexes[0];
      let segmentEnd = positiveIndexes[0];

      for (let index = 1; index < positiveIndexes.length; index += 1) {
        const current = positiveIndexes[index];
        if (current === segmentEnd + 1) {
          segmentEnd = current;
          continue;
        }

        segments.push({
          start: Math.max(0, segmentStart - 1),
          end: Math.min(chartPoints.length - 1, segmentEnd + 1)
        });
        segmentStart = current;
        segmentEnd = current;
      }

      segments.push({
        start: Math.max(0, segmentStart - 1),
        end: Math.min(chartPoints.length - 1, segmentEnd + 1)
      });
    }

    if (!segments.length) {
      rainArea.setAttribute("d", "");
      if (rainLine) {
        rainLine.setAttribute("d", "");
      }
      return;
    }

    const linePath = segments.map((segmentRange) => {
      const segment = chartPoints.slice(segmentRange.start, segmentRange.end + 1).map((point) => ({
        ...point,
        y: point.value <= 0 ? 88 : point.y
      }));
      return segment.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
    }).join(" ");

    const areaPath = segments.map((segmentRange) => {
      const segment = chartPoints.slice(segmentRange.start, segmentRange.end + 1).map((point) => ({
        ...point,
        y: point.value <= 0 ? 88 : point.y
      }));
      const first = segment[0];
      const last = segment[segment.length - 1];
      const top = segment.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
      return `${top} L ${last.x.toFixed(2)} 88 L ${first.x.toFixed(2)} 88 Z`;
    }).join(" ");

    rainArea.setAttribute("d", areaPath);
    if (rainLine) {
      rainLine.setAttribute("d", linePath);
    }
  }
}

async function bootWeather() {
  try {
    const response = await fetch("/api/weather", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Weer kon niet worden opgehaald");
    }

    const payload = await response.json();
    renderWeather(payload);
  } catch (error) {
    showToast(error.message);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHomeLights(payload) {
  if (!roomBlocks) return;

  const entities = (Array.isArray(payload.entities) ? payload.entities : []).map((entity) => {
    const pending = pendingHomeExpectations.get(entity.entityId);
    if (!pending) {
      return entity;
    }

    if (pending.type === "toggle") {
      return {
        ...entity,
        isOn: pending.isOn
      };
    }

    if (pending.type === "brightness") {
      return {
        ...entity,
        isOn: pending.brightness > 0 ? true : entity.isOn,
        brightness: pending.brightness
      };
    }

    return entity;
  });

  homeState.entities = entities;
  homeState.allRooms = [];
  ensureHomeSelection(entities);
  const visibleRooms = buildHomeDisplayRooms(entities);

  homeState.rooms = visibleRooms;

  roomBlocks.innerHTML = visibleRooms.map((room) => `
    <div class="room-block">
      <p class="room-label">${escapeHtml(room.room)}</p>
      ${room.items.map((item) => `
        <div class="light-row ${item.dimmable ? "dimmable-row" : ""}" data-entity-ids="${escapeHtml(item.entityIds.join(","))}" data-brightness="${Number(item.brightness || 0)}" data-is-on="${item.isOn ? "true" : "false"}">
          <button class="power-button ${item.isOn ? "is-on" : ""}" aria-label="${escapeHtml(item.label)} toggelen"></button>
          ${item.dimmable ? `
            <div class="slider-stack">
              <div class="dimmer-label">
                <span class="device-label">${getOfflineBadgeMarkup(item)}${escapeHtml(item.label)}</span>
                <span class="dimmer-pct">${Number(item.brightness || 0)}%</span>
              </div>
              <div class="slider-controls">
                <button class="adjust-button" type="button" data-step="-10" aria-label="${escapeHtml(item.label)} zachter">−</button>
                <input class="brightness-slider" type="range" min="1" max="100" value="${Number(item.brightness || 0)}" aria-label="${escapeHtml(item.label)} helderheid">
                <button class="adjust-button" type="button" data-step="10" aria-label="${escapeHtml(item.label)} feller">+</button>
              </div>
            </div>
          ` : `
            <button class="name-button clickable" data-card="lamp-${escapeHtml(item.entityIds.join("-"))}"><span class="device-label">${getOfflineBadgeMarkup(item)}${escapeHtml(item.label)}</span></button>
          `}
        </div>
      `).join("")}
    </div>
  `).join("");

  renderHomeSettingsList();
}

async function loadHomeLights() {
  const response = await fetch("/api/home/lights", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Lampen konden niet worden opgehaald");
  }

  const payload = await response.json();
  renderHomeLights(payload);
  return payload;
}

async function bootHome() {
  try {
    await loadHomeLights();
  } catch (error) {
    showToast(error.message);
  }
}

function getSelectedHomeEntityIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOME_SELECTION_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveSelectedHomeEntityIds(selected) {
  localStorage.setItem(HOME_SELECTION_KEY, JSON.stringify([...selected]));
}

function getHomeGroupMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOME_GROUP_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveHomeGroupMap(groupMap) {
  localStorage.setItem(HOME_GROUP_KEY, JSON.stringify(groupMap));
}

function normaliseGroupName(value) {
  return String(value || "").trim();
}

function compareHomeRoomNames(a, b) {
  const aIndex = HOME_ROOM_ORDER.indexOf(a);
  const bIndex = HOME_ROOM_ORDER.indexOf(b);

  if (aIndex !== -1 || bIndex !== -1) {
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    if (aIndex !== bIndex) return aIndex - bIndex;
  }

  return a.localeCompare(b);
}

function getOfflineBadgeMarkup(item) {
  return item.unavailable ? `<span class="offline-badge" title="Offline" aria-label="Offline">!</span>` : "";
}

function buildHomeDisplayRooms(entities) {
  const selected = getSelectedHomeEntityIds();
  const groupMap = getHomeGroupMap();
  const visibleEntities = entities.filter((entity) => selected.has(entity.entityId));
  const rooms = new Map();

  for (const entity of visibleEntities) {
    const roomName = entity.room || "Other";
    if (!rooms.has(roomName)) {
      rooms.set(roomName, new Map());
    }

    const groupName = normaliseGroupName(groupMap[entity.entityId]);
    const key = groupName ? `group:${groupName}` : `entity:${entity.entityId}`;

    if (!rooms.get(roomName).has(key)) {
      rooms.get(roomName).set(key, {
        key,
        room: roomName,
        label: groupName || entity.label,
        groupName: groupName || null,
        entityIds: [],
        entities: [],
        dimmable: true,
        unavailable: false
      });
    }

    const row = rooms.get(roomName).get(key);
    row.entities.push(entity);
    row.entityIds.push(entity.entityId);
    row.dimmable = row.dimmable && entity.dimmable;
    row.unavailable = row.unavailable || entity.unavailable;
  }

  return [...rooms.entries()]
    .sort((a, b) => compareHomeRoomNames(a[0], b[0]))
    .map(([room, entries]) => ({
      room,
      items: [...entries.values()]
        .map((item) => {
          const activeEntities = item.entities.filter((entity) => !entity.unavailable);
          const dimmableEntities = item.entities.filter((entity) => entity.dimmable);
          const brightnessBase = dimmableEntities.length
            ? dimmableEntities.reduce((sum, entity) => sum + Number(entity.brightness || 0), 0) / dimmableEntities.length
            : 0;

          return {
            ...item,
            isGrouped: Boolean(item.groupName && item.entities.length > 1),
            isOn: activeEntities.some((entity) => entity.isOn),
            brightness: Math.round(brightnessBase),
            dimmable: item.dimmable && dimmableEntities.length > 0,
            memberLabels: item.entities.map((entity) => entity.label)
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label))
    }))
    .filter((room) => room.items.length > 0);
}

function ensureHomeSelection(entities) {
  const selected = getSelectedHomeEntityIds();
  if (selected.size === 0) {
    saveSelectedHomeEntityIds(new Set(entities.map((entity) => entity.entityId)));
    return;
  }

  const entityIds = new Set(entities.map((entity) => entity.entityId));
  const hasOverlap = [...selected].some((entityId) => entityIds.has(entityId));

  if (!hasOverlap) {
    saveSelectedHomeEntityIds(new Set(entityIds));
  }
}

function renderHomeSettingsList() {
  if (!settingsDeviceList) return;

  const selected = getSelectedHomeEntityIds();
  const sortedEntities = [...homeState.entities].sort((a, b) => compareHomeRoomNames(a.room || "Other", b.room || "Other") || a.label.localeCompare(b.label));
  const grouped = new Map();

  for (const entity of sortedEntities) {
    const roomName = entity.room || "Other";
    if (!grouped.has(roomName)) {
      grouped.set(roomName, []);
    }
    grouped.get(roomName).push(entity);
  }

  settingsDeviceList.innerHTML = [...grouped.entries()].map(([roomName, entities]) => `
    <section class="settings-room-group">
      <p class="settings-room-label">${escapeHtml(roomName)}</p>
      ${entities.map((entity) => `
        <label class="settings-device-item">
          <input type="checkbox" data-entity-id="${escapeHtml(entity.entityId)}" ${selected.has(entity.entityId) ? "checked" : ""}>
          <span class="settings-device-copy">
            <span class="settings-device-name">${getOfflineBadgeMarkup(entity)}${escapeHtml(entity.label)}</span>
            <span class="settings-device-meta">${escapeHtml(entity.domain || "")}</span>
          </span>
        </label>
      `).join("")}
    </section>
  `).join("");
}

function setHomeSettingsOpen(isOpen) {
  if (!homeSettingsModal) return;
  homeSettingsModal.classList.toggle("is-hidden", !isOpen);
}

function setHomeGroupOpen(isOpen) {
  if (!homeGroupModal) return;
  homeGroupModal.classList.toggle("is-hidden", !isOpen);
  if (!isOpen && groupNameInput) {
    groupNameInput.value = "";
  }
}

function parseEntityIdsFromRow(row) {
  return String(row?.dataset.entityIds || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHomeEntitiesByIds(entityIds, entities = homeState.entities) {
  const wanted = new Set(entityIds);
  return entities.filter((entity) => wanted.has(entity.entityId));
}

function doesHomeStateMatch(entityIds, expectation, entities = homeState.entities) {
  const matches = getHomeEntitiesByIds(entityIds, entities).filter((entity) => !entity.unavailable);
  if (!matches.length) return false;

  if (expectation.type === "toggle") {
    return matches.every((entity) => Boolean(entity.isOn) === Boolean(expectation.isOn));
  }

  if (expectation.type === "brightness") {
    const dimmableMatches = matches.filter((entity) => entity.dimmable);
    if (!dimmableMatches.length) return false;
    return dimmableMatches.every((entity) => {
      const brightness = Number(entity.brightness || 0);
      const isClose = Math.abs(brightness - expectation.brightness) <= 8;
      return isClose && (expectation.brightness <= 1 || entity.isOn);
    });
  }

  return false;
}

function setPendingExpectation(entityIds, expectation) {
  entityIds.forEach((entityId) => pendingHomeExpectations.set(entityId, expectation));
}

function clearPendingExpectation(entityIds) {
  entityIds.forEach((entityId) => pendingHomeExpectations.delete(entityId));
}

function setLightRowBrightness(row, brightness) {
  if (!row) return;
  const pct = Math.max(1, Math.min(100, Math.round(brightness)));
  row.dataset.brightness = String(pct);
  const pctEl = row.querySelector(".dimmer-pct");
  const slider = row.querySelector(".brightness-slider");
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (slider) slider.value = String(pct);
}

function setHomeRowPending(row, isPending) {
  if (!row) return;
  row.classList.toggle("is-pending", isPending);
  row.querySelectorAll("button, input").forEach((element) => {
    element.disabled = isPending;
  });
}

function getVisibleHomeEntities() {
  const selected = getSelectedHomeEntityIds();
  return [...homeState.entities]
    .filter((entity) => selected.has(entity.entityId))
    .sort((a, b) => compareHomeRoomNames(a.room || "Other", b.room || "Other") || a.label.localeCompare(b.label));
}

function renderHomeGroupList() {
  if (!groupDeviceList) return;
  const entities = getVisibleHomeEntities();
  const grouped = new Map();

  for (const entity of entities) {
    const roomName = entity.room || "Other";
    if (!grouped.has(roomName)) grouped.set(roomName, []);
    grouped.get(roomName).push(entity);
  }

  groupDeviceList.innerHTML = [...grouped.entries()].map(([roomName, roomEntities]) => `
    <section class="settings-room-group">
      <p class="settings-room-label">${escapeHtml(roomName)}</p>
      ${roomEntities.map((entity) => `
        <label class="settings-device-item">
          <input type="checkbox" data-group-select-id="${escapeHtml(entity.entityId)}">
          <span class="settings-device-copy">
            <span class="settings-device-name">${getOfflineBadgeMarkup(entity)}${escapeHtml(entity.label)}</span>
            <span class="settings-device-meta">${escapeHtml(entity.domain || "")}</span>
          </span>
        </label>
      `).join("")}
    </section>
  `).join("");
}

async function refreshHomeStateAfterAction() {
  await delay(300);
  await loadHomeLights();
}

async function syncHomeStateAfterAction(entityIds, expectation) {
  const timeoutAt = Date.now() + 3500;

  while (Date.now() < timeoutAt) {
    const payload = await loadHomeLights();
    if (doesHomeStateMatch(entityIds, expectation, payload.entities || [])) {
      clearPendingExpectation(entityIds);
      await loadHomeLights();
      return true;
    }
    await delay(250);
  }

  clearPendingExpectation(entityIds);
  await loadHomeLights();
  return false;
}

function getSportsViewItems(payload, view) {
  if (!payload) return [];
  if (view === "upcoming") return Array.isArray(payload.upcomingItems) ? payload.upcomingItems : [];
  return Array.isArray(payload.todayItems) ? payload.todayItems : [];
}

function getInitials(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

function splitSportsTitle(title) {
  const parts = String(title || "").split(/\s+vs\.?\s+/i);
  if (parts.length >= 2) {
    return {
      left: parts[0].trim(),
      right: parts.slice(1).join(" vs ").trim()
    };
  }

  return { left: title || "", right: "" };
}

function normaliseCountryName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COUNTRY_FLAG_ALIASES = {
  afghanistan: "AF", albania: "AL", algeria: "DZ", andorra: "AD", angola: "AO", argentina: "AR", armenia: "AM", australia: "AU", austria: "AT", azerbaijan: "AZ",
  bahrain: "BH", bangladesh: "BD", belarus: "BY", belgium: "BE", belize: "BZ", benin: "BJ", bhutan: "BT", bolivia: "BO", "bosnia and herzegovina": "BA", "bosnia h": "BA", bosnia: "BA", botswana: "BW", brazil: "BR", brunei: "BN", bulgaria: "BG", burkina: "BF", burundi: "BI",
  cambodia: "KH", cameroon: "CM", canada: "CA", chile: "CL", china: "CN", colombia: "CO", congo: "CG", "costa rica": "CR", croatia: "HR", cuba: "CU", cyprus: "CY", czechia: "CZ", "czech republic": "CZ",
  denmark: "DK", djibouti: "DJ", dominica: "DM", "dominican republic": "DO",
  ecuador: "EC", egypt: "EG", "el salvador": "SV", england: "GB", estonia: "EE", eswatini: "SZ", ethiopia: "ET",
  fiji: "FJ", finland: "FI", france: "FR",
  gabon: "GA", gambia: "GM", georgia: "GE", germany: "DE", ghana: "GH", greece: "GR", guatemala: "GT", guinea: "GN",
  haiti: "HT", honduras: "HN", hungary: "HU",
  iceland: "IS", india: "IN", indonesia: "ID", iran: "IR", iraq: "IQ", ireland: "IE", israel: "IL", italy: "IT", "ivory coast": "CI", "cote d ivoire": "CI",
  jamaica: "JM", japan: "JP", jordan: "JO",
  kazakhstan: "KZ", kenya: "KE", kosovo: "XK", kuwait: "KW", kyrgyzstan: "KG",
  laos: "LA", latvia: "LV", lebanon: "LB", liberia: "LR", libya: "LY", liechtenstein: "LI", lithuania: "LT", luxembourg: "LU",
  madagascar: "MG", malawi: "MW", malaysia: "MY", mali: "ML", malta: "MT", mauritania: "MR", mauritius: "MU", mexico: "MX", moldova: "MD", mongolia: "MN", montenegro: "ME", morocco: "MA", mozambique: "MZ", myanmar: "MM",
  namibia: "NA", nepal: "NP", netherlands: "NL", "new zealand": "NZ", nicaragua: "NI", niger: "NE", nigeria: "NG", "north korea": "KP", "north macedonia": "MK", norway: "NO",
  oman: "OM",
  pakistan: "PK", palestine: "PS", panama: "PA", paraguay: "PY", peru: "PE", philippines: "PH", poland: "PL", portugal: "PT",
  qatar: "QA",
  romania: "RO", russia: "RU", rwanda: "RW",
  "saudi arabia": "SA", scotland: "GB", senegal: "SN", serbia: "RS", singapore: "SG", slovakia: "SK", slovenia: "SI", somalia: "SO", "south africa": "ZA", "south korea": "KR", "republic of korea": "KR", "korea republic": "KR", spain: "ES", "sri lanka": "LK", sudan: "SD", suriname: "SR", sweden: "SE", switzerland: "CH", syria: "SY",
  taiwan: "TW", tajikistan: "TJ", tanzania: "TZ", thailand: "TH", togo: "TG", trinidad: "TT", tunisia: "TN", turkey: "TR", turkmenistan: "TM",
  uganda: "UG", ukraine: "UA", "united arab emirates": "AE", "united states": "US", "united states of america": "US", usa: "US", uruguay: "UY", uzbekistan: "UZ",
  venezuela: "VE", vietnam: "VN",
  wales: "GB",
  yemen: "YE",
  zambia: "ZM", zimbabwe: "ZW"
};

function getFlagEmojiFromCode(code) {
  if (!code || code.length !== 2) {
    return null;
  }

  return code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

function getCountryFlag(name) {
  const normalised = normaliseCountryName(name);
  const match = Object.keys(COUNTRY_FLAG_ALIASES)
    .sort((a, b) => b.length - a.length)
    .find((key) => normalised === key || normalised.includes(key));
  return match ? getFlagEmojiFromCode(COUNTRY_FLAG_ALIASES[match]) : null;
}

function renderSportsTimeLabel(value) {
  const text = String(value || "--:--").trim();

  if (/^\d{2}:\d{2}$/.test(text) || text.toLowerCase() === "morgen") {
    return `<span class="sports-time-label">${escapeHtml(text)}</span>`;
  }

  const parts = text.split(/\s+/);
  if (parts.length >= 3) {
    return `<span class="sports-time-label sports-time-label-date"><span>${escapeHtml(parts.slice(0, 2).join(" "))}</span><span>${escapeHtml(parts.slice(2).join(" "))}</span></span>`;
  }

  return `<span class="sports-time-label">${escapeHtml(text)}</span>`;
}

function getClubToken(name) {
  const tokens = {
    ajax: "A",
    psv: "PSV",
    feyenoord: "F",
    az: "AZ"
  };

  const normalised = normaliseCountryName(name);
  const match = Object.keys(tokens).find((key) => normalised.includes(key));
  return match ? tokens[match] : getInitials(name);
}

function getTennisPhotoFocus(name) {
  const focusMap = {
    "Alexander Zverev": "center 18%",
    "Flavio Cobolli": "center 20%"
  };

  return focusMap[name] || "center 22%";
}

function renderSportsSide(name, type, side) {
  const sideClass = side === "left" ? "is-left" : "is-right";
  const countryFlag = type === "football" ? getCountryFlag(name) : null;

  if (countryFlag) {
    return `<span class="sports-side-flag ${sideClass}" aria-hidden="true">${countryFlag}</span>`;
  }

  if (type === "tennis") {
    return `<span class="sports-side sports-side-token ${sideClass}" data-tennis-player="${escapeHtml(name)}" aria-hidden="true">${escapeHtml(getInitials(name))}</span>`;
  }

  const token = type === "football" ? getClubToken(name) : getInitials(name);
  return `<span class="sports-side sports-side-token ${sideClass}" aria-hidden="true">${escapeHtml(token)}</span>`;
}

function renderSportsItem(item) {
  const title = item.title || "Sportevent";
  const match = splitSportsTitle(title);
  const sportLabel = item.type === "tennis" ? "Tennis" : "Voetbal";
  const sportSymbol = item.type === "tennis" ? "🎾" : "⚽";
  const matchClass = item.type === "tennis" ? "sports-match is-tennis" : "sports-match";

  return `
    <div class="sports-item sports-item-rich">
      <span class="sports-time">${renderSportsTimeLabel(item.time || "--:--")}</span>
      <div class="sports-main sports-main-centered">
        <div class="sports-visuals">
          ${renderSportsSide(match.left, item.type, "left")}
          <div class="sports-copy sports-copy-centered">
            <p class="sports-sportline"><span class="sports-symbol">${sportSymbol}</span><span>${sportLabel}</span></p>
            <p class="${matchClass}">${escapeHtml(title)}</p>
            <p class="sports-meta">${escapeHtml(item.meta || "")}</p>
          </div>
          ${renderSportsSide(match.right || match.left, item.type, "right")}
        </div>
      </div>
    </div>
  `;
}

function applySportsTextFit() {
  document.querySelectorAll(".sports-match").forEach((element) => {
    element.classList.remove("is-tight", "is-tighter");
    element.style.fontSize = "";

    if (element.classList.contains("is-tennis")) {
      return;
    }

    if (element.scrollWidth <= element.clientWidth) {
      return;
    }

    element.classList.add("is-tight");

    if (element.scrollWidth <= element.clientWidth) {
      return;
    }

    element.classList.add("is-tighter");

    if (element.scrollWidth <= element.clientWidth) {
      return;
    }

    let fontSize = parseFloat(window.getComputedStyle(element).fontSize);

    while (element.scrollWidth > element.clientWidth && fontSize > 10.5) {
      fontSize -= 0.5;
      element.style.fontSize = `${fontSize}px`;
    }
  });
}

async function hydrateTennisPhotos() {
  const frames = [...document.querySelectorAll("[data-tennis-player]")];
  const names = [...new Set(frames.map((element) => element.dataset.tennisPlayer).filter(Boolean))];

  if (!names.length) {
    return;
  }

  const params = new URLSearchParams();
  names.forEach((name) => params.append("name", name));

  try {
    const response = await fetch(`/api/tennis-photos?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const players = payload.players || {};

    frames.forEach((element) => {
      const name = element.dataset.tennisPlayer;
      const player = players[name];
      if (!player?.imageUrl) {
        return;
      }

      element.style.backgroundImage = `url("${player.imageUrl}")`;
      element.style.backgroundPosition = getTennisPhotoFocus(name);
      element.classList.add("is-photo");
      element.textContent = "";
    });
  } catch {
    // Keep initials as fallback.
  }
}

function updateSportsTabs() {
  sportsTabs.forEach((tab) => {
    const isActive = tab.dataset.sportsView === sportsState.view;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function renderSports(payload) {
  if (!sportsList) {
    return;
  }

  sportsState.payload = payload;
  updateSportsTabs();

  const items = getSportsViewItems(payload, sportsState.view);

  if (sportsSummary) {
    sportsSummary.textContent = "";
  }

  if (!items.length) {
    sportsList.innerHTML = `
      <div class="sports-item sports-item-empty">
        <div class="sports-copy">
          <p class="sports-match">${sportsState.view === "upcoming" ? "Nog geen interessante wedstrijden gevonden." : "Vandaag geen relevante wedstrijden gevonden."}</p>
          <p class="sports-meta">Tennis, Eredivisie, Champions League, EK/WK en grote affiches.</p>
        </div>
      </div>
    `;
    return;
  }

  sportsList.innerHTML = items.slice(0, 5).map(renderSportsItem).join("");
  requestAnimationFrame(applySportsTextFit);
  void hydrateTennisPhotos();
}

async function bootSports() {
  try {
    const response = await fetch("/api/sports", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Sport kon niet worden opgehaald");
    }

    const payload = await response.json();
    renderSports(payload);
  } catch (error) {
    showToast(error.message);
  }
}

function renderNews(payload) {
  newsState.payload = payload;
  const activeTab = payload?.tabs?.general || { items: [] };

  if (newsFeedLabel) {
    newsFeedLabel.textContent = activeTab.feedTitle || "Nieuws";
  }

  if (!newsList || !Array.isArray(activeTab.items)) {
    return;
  }

  newsList.innerHTML = activeTab.items.map((item, index) => {
    const fallbackClass = ["ns-thumb", "ecb-thumb", "sport-thumb"][index % 3];
    const thumbContent = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : "";

    return `
      <button class="news-item" type="button" data-article-link="${escapeHtml(item.link || "https://nos.nl/")}" data-article-title="${escapeHtml(item.title)}" data-article-source="${escapeHtml(item.source || activeTab.feedTitle || "Nieuws")}" data-article-image="${escapeHtml(item.image || "")}" data-article-body="${escapeHtml(item.body || "")}" data-article-published="${escapeHtml(item.publishedAt || "")}">
        <div class="news-thumb ${fallbackClass}">${thumbContent}</div>
        <div class="news-copy">
          <p class="news-title">${escapeHtml(item.title)}</p>
          <p class="news-source">${escapeHtml(item.source || "NOS Nieuws")}</p>
        </div>
      </button>
    `;
  }).join("");
}

function renderFootballNews(payload) {
  const activeTab = payload?.tabs?.football || { items: [] };

  if (footballFeedLabel) {
    footballFeedLabel.textContent = activeTab.feedTitle || "Voetbalnieuws";
  }

  if (!footballNewsList || !Array.isArray(activeTab.items)) {
    return;
  }

  footballNewsList.innerHTML = activeTab.items.map((item, index) => {
    const fallbackClass = ["ns-thumb", "ecb-thumb", "sport-thumb"][index % 3];
    const thumbContent = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : "";

    return `
      <button class="news-item" type="button" data-article-link="${escapeHtml(item.link || "https://nos.nl/")}" data-article-title="${escapeHtml(item.title)}" data-article-source="${escapeHtml(item.source || activeTab.feedTitle || "Nieuws")}" data-article-image="${escapeHtml(item.image || "")}" data-article-body="${escapeHtml(item.body || "")}" data-article-published="${escapeHtml(item.publishedAt || "")}">
        <div class="news-thumb ${fallbackClass}">${thumbContent}</div>
        <div class="news-copy">
          <p class="news-title">${escapeHtml(item.title)}</p>
          <p class="news-source">${escapeHtml(item.source || "VoetbalPrimeur")}</p>
        </div>
      </button>
    `;
  }).join("");
}

async function bootNews() {
  try {
    const response = await fetch("/api/news", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Nieuws kon niet worden opgehaald");
    }

    const payload = await response.json();
    renderNews(payload);
    renderFootballNews(payload);
  } catch (error) {
    showToast(error.message);
  }
}

function setArticleModalOpen(isOpen) {
  if (!articleModal) return;
  articleModal.classList.toggle("is-hidden", !isOpen);
  if (!isOpen && articleFrame) {
    articleFrame.src = "about:blank";
  }
}

function formatNosArticleDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "Vandaag";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderNosArticle(item) {
  if (!nosArticleView || !nosArticleTitle || !nosArticleCopy || !articleModalHeader || !articleFrameWrap) {
    return;
  }

  articleModalHeader.classList.add("is-hidden");
  articleFrameWrap.classList.add("is-hidden");
  nosArticleView.classList.remove("is-hidden");

  nosArticleTitle.textContent = item.title || "NOS Artikel";
  nosArticleDate.textContent = formatNosArticleDate(item.publishedAt);

  const paragraphs = String(item.body || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  nosArticleCopy.innerHTML = paragraphs.length
    ? paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")
    : `<p>Dit artikel is afkomstig uit de NOS-feed.</p>`;

  if (item.image && nosArticleImageWrap && nosArticleImage) {
    nosArticleImageWrap.classList.remove("is-hidden");
    nosArticleImage.src = item.image;
    nosArticleImage.alt = item.title || "NOS artikelbeeld";
  } else if (nosArticleImageWrap && nosArticleImage) {
    nosArticleImageWrap.classList.add("is-hidden");
    nosArticleImage.removeAttribute("src");
    nosArticleImage.alt = "";
  }
}

function openArticle(item) {
  if (!articleFrame || !articleModalTitle || !articleModalSource || !articleModalHeader || !articleFrameWrap || !nosArticleView) return;

  if ((item.source || "").toLowerCase().includes("nos")) {
    renderNosArticle(item);
    setArticleModalOpen(true);
    return;
  }

  nosArticleView.classList.add("is-hidden");
  articleModalHeader.classList.remove("is-hidden");
  articleFrameWrap.classList.remove("is-hidden");
  articleModalTitle.textContent = item.title || "Artikel";
  articleModalSource.textContent = item.source || "Nieuwsbron";
  articleFrame.src = item.link || "https://www.voetbalprimeur.nl/";
  setArticleModalOpen(true);
}

document.querySelectorAll(".clickable[data-card]").forEach((element) => {
  element.addEventListener("click", () => {
    const labels = {
      "agenda-joost": "Hier opent later Joost z'n weekagenda.",
      "agenda-partner": "Hier opent later Noor d'r weekagenda.",
      "lamp-standing": "Later naar detail of ruimteweergave.",
      "lamp-lampie": "Later naar detail of ruimteweergave.",
    };
    showToast(labels[element.dataset.card] || "Interactietest");
  });
});

widgetDots.forEach((dot) => {
  dot.addEventListener("click", () => setWidget(dot.dataset.target));
});

if (widgetPages.length && widgetPagesContainer) {
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeTracking = false;
  let swipeAllowed = false;

  const moveWidgetBy = (direction) => {
    const currentIndex = Math.max(0, WIDGET_ORDER.indexOf(activeWidget));
    const nextIndex = Math.max(0, Math.min(WIDGET_ORDER.length - 1, currentIndex + direction));
    if (nextIndex !== currentIndex) {
      setWidget(WIDGET_ORDER[nextIndex]);
    }
  };

  widgetPagesContainer.addEventListener("touchstart", (event) => {
    if (!event.touches.length) return;
    const touch = event.touches[0];
    swipeTracking = true;
    swipeStartX = touch.clientX;
    swipeStartY = touch.clientY;
    swipeAllowed = true;
  }, { passive: true });

  widgetPagesContainer.addEventListener("touchend", (event) => {
    if (!swipeTracking) return;
    const canSwipe = swipeAllowed;
    swipeTracking = false;
    swipeAllowed = false;
    if (!canSwipe) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const deltaX = touch.clientX - swipeStartX;
    const deltaY = touch.clientY - swipeStartY;

    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    moveWidgetBy(deltaX < 0 ? 1 : -1);
  }, { passive: true });

  widgetPagesContainer.addEventListener("touchcancel", () => {
    swipeTracking = false;
    swipeAllowed = false;
  }, { passive: true });
}

sportsTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    sportsState.view = tab.dataset.sportsView || "today";
    renderSports(sportsState.payload || { todayItems: [], upcomingItems: [] });
  });
});

if (googleConnectButton) {
  googleConnectButton.addEventListener("click", async () => {
    try {
      const status = await loadCalendarStatus();

      if (!status.configured) {
        showToast("Vul eerst de Google-velden in .env in.");
        return;
      }

      window.location.href = "/auth/google/start";
    } catch (error) {
      showToast(error.message);
    }
  });
}

if (roomBlocks) {
  roomBlocks.addEventListener("click", async (event) => {
    const powerButton = event.target.closest(".power-button");
    if (powerButton) {
      const row = powerButton.closest(".light-row");
      const entityIds = parseEntityIdsFromRow(row);
      if (!entityIds.length) return;
      if (entityIds.some((entityId) => pendingHomeEntityIds.has(entityId))) return;

      const desiredState = row?.dataset.isOn !== "true";
      entityIds.forEach((entityId) => pendingHomeEntityIds.add(entityId));
      setPendingExpectation(entityIds, {
        type: "toggle",
        isOn: desiredState
      });
      row.dataset.isOn = desiredState ? "true" : "false";
      powerButton.classList.toggle("is-on", desiredState);
      setHomeRowPending(row, true);

      try {
        const response = await fetch("/api/home/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityIds, desiredState })
        });

        if (!response.ok) {
          throw new Error("Lamp kon niet worden omgezet");
        }

        await syncHomeStateAfterAction(entityIds, {
          type: "toggle",
          isOn: desiredState
        });
      } catch (error) {
        clearPendingExpectation(entityIds);
        showToast(error.message);
        await loadHomeLights();
      } finally {
        entityIds.forEach((entityId) => pendingHomeEntityIds.delete(entityId));
      }
      return;
    }

    const adjustButton = event.target.closest(".adjust-button");
    if (!adjustButton) return;

    const row = adjustButton.closest(".light-row");
    const slider = row?.querySelector(".brightness-slider");
    const entityIds = parseEntityIdsFromRow(row);
    if (!slider || !entityIds.length) return;
    if (entityIds.some((entityId) => pendingHomeEntityIds.has(entityId))) return;

    const nextBrightness = Math.max(1, Math.min(100, Number(slider.value) + Number(adjustButton.dataset.step || 0)));
    slider.value = String(nextBrightness);
    setLightRowBrightness(row, nextBrightness);
    setHomeRowPending(row, true);
    entityIds.forEach((entityId) => pendingHomeEntityIds.add(entityId));
    setPendingExpectation(entityIds, {
      type: "brightness",
      brightness: nextBrightness
    });

    try {
      const response = await fetch("/api/home/dim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityIds, brightness: nextBrightness })
      });

      if (!response.ok) {
        throw new Error("Dimmer kon niet worden bijgewerkt");
      }

      await syncHomeStateAfterAction(entityIds, {
        type: "brightness",
        brightness: nextBrightness
      });
    } catch (error) {
      clearPendingExpectation(entityIds);
      showToast(error.message);
      await loadHomeLights();
    } finally {
      entityIds.forEach((entityId) => pendingHomeEntityIds.delete(entityId));
    }
  });

  roomBlocks.addEventListener("input", (event) => {
    const slider = event.target.closest(".brightness-slider");
    if (!slider) return;

    const row = slider.closest(".light-row");
    setLightRowBrightness(row, Number(slider.value));
  });

  roomBlocks.addEventListener("change", async (event) => {
    const slider = event.target.closest(".brightness-slider");
    if (!slider) return;

    const row = slider.closest(".light-row");
    const entityIds = parseEntityIdsFromRow(row);
    if (!entityIds.length) return;
    if (entityIds.some((entityId) => pendingHomeEntityIds.has(entityId))) return;

    const brightness = Number(slider.value);
    setHomeRowPending(row, true);
    entityIds.forEach((entityId) => pendingHomeEntityIds.add(entityId));
    setPendingExpectation(entityIds, {
      type: "brightness",
      brightness
    });

    try {
      const response = await fetch("/api/home/dim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityIds, brightness })
      });

      if (!response.ok) {
        throw new Error("Dimmer kon niet worden bijgewerkt");
      }

      await syncHomeStateAfterAction(entityIds, {
        type: "brightness",
        brightness
      });
    } catch (error) {
      clearPendingExpectation(entityIds);
      showToast(error.message);
      await loadHomeLights();
    } finally {
      entityIds.forEach((entityId) => pendingHomeEntityIds.delete(entityId));
    }
  });
}

if (homeSettingsButton) {
  homeSettingsButton.addEventListener("click", () => {
    renderHomeSettingsList();
    setHomeSettingsOpen(true);
  });
}

if (homeSettingsClose) {
  homeSettingsClose.addEventListener("click", () => setHomeSettingsOpen(false));
}

if (homeSettingsModal) {
  homeSettingsModal.addEventListener("click", (event) => {
    if (event.target === homeSettingsModal) {
      setHomeSettingsOpen(false);
    }
  });

  homeSettingsModal.addEventListener("change", (event) => {
    const checkbox = event.target.closest('input[type="checkbox"][data-entity-id]');
    if (!checkbox) return;

    const selected = getSelectedHomeEntityIds();
    if (checkbox.checked) {
      selected.add(checkbox.dataset.entityId);
    } else {
      selected.delete(checkbox.dataset.entityId);
    }
    saveSelectedHomeEntityIds(selected);
    renderHomeLights({ entities: homeState.entities });
  });
}

if (homeGroupButton) {
  homeGroupButton.addEventListener("click", () => {
    renderHomeGroupList();
    setHomeGroupOpen(true);
  });
}

if (homeGroupClose) {
  homeGroupClose.addEventListener("click", () => setHomeGroupOpen(false));
}

if (homeGroupCancel) {
  homeGroupCancel.addEventListener("click", () => setHomeGroupOpen(false));
}

if (homeGroupModal) {
  homeGroupModal.addEventListener("click", (event) => {
    if (event.target === homeGroupModal) {
      setHomeGroupOpen(false);
    }
  });
}

if (homeGroupSave) {
  homeGroupSave.addEventListener("click", () => {
    const groupName = normaliseGroupName(groupNameInput?.value || "");
    const selectedIds = [...document.querySelectorAll('[data-group-select-id]:checked')].map((input) => input.dataset.groupSelectId).filter(Boolean);

    if (!groupName) {
      showToast("Geef de groep een naam.");
      return;
    }

    if (!selectedIds.length) {
      showToast("Kies minstens 1 apparaat.");
      return;
    }

    const groupMap = getHomeGroupMap();
    selectedIds.forEach((entityId) => {
      groupMap[entityId] = groupName;
    });
    saveHomeGroupMap(groupMap);
    setHomeGroupOpen(false);
    renderHomeLights({ entities: homeState.entities });
  });
}

if (newsList) {
  newsList.addEventListener("click", (event) => {
    const button = event.target.closest(".news-item[data-article-link]");
    if (!button) return;

    openArticle({
      link: button.dataset.articleLink,
      title: button.dataset.articleTitle,
      source: button.dataset.articleSource,
      image: button.dataset.articleImage,
      body: button.dataset.articleBody,
      publishedAt: button.dataset.articlePublished
    });
  });
}

if (footballNewsList) {
  footballNewsList.addEventListener("click", (event) => {
    const button = event.target.closest(".news-item[data-article-link]");
    if (!button) return;

    openArticle({
      link: button.dataset.articleLink,
      title: button.dataset.articleTitle,
      source: button.dataset.articleSource,
      image: button.dataset.articleImage,
      body: button.dataset.articleBody,
      publishedAt: button.dataset.articlePublished
    });
  });
}

if (articleModalClose) {
  articleModalClose.addEventListener("click", () => setArticleModalOpen(false));
}

if (nosArticleClose) {
  nosArticleClose.addEventListener("click", () => setArticleModalOpen(false));
}

if (articleModal) {
  articleModal.addEventListener("click", (event) => {
    if (event.target === articleModal) {
      setArticleModalOpen(false);
    }
  });
}

updateClock();
setInterval(updateClock, 30000);
bootCalendar();
bootHome();
bootSports();
bootWeather();
bootNews();
