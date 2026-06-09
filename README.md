# Home Planner – Home Assistant Addon

## Installeren

### Stap 1: GitHub repo aanmaken
Maak een nieuwe **public** GitHub repository aan en upload de volledige inhoud van deze map daarin.

### Stap 2: Addon repository toevoegen aan HA
1. Ga in Home Assistant naar **Instellingen → Add-ons → Add-on Store**
2. Klik rechtsboven op de **⋮** menu → **Repositories**
3. Voeg toe: `https://github.com/JOUW_GEBRUIKERSNAAM/home-planner-addon`
4. De addon verschijnt nu in de store onder de naam **Home Planner**

### Stap 3: Addon installeren en configureren
1. Klik op **Home Planner** → **Installeren**
2. Ga naar het tabblad **Configuratie** en vul in:
   - `WEATHER_LATITUDE` / `WEATHER_LONGITUDE`: jouw locatie (standaard Eindhoven)
   - `FOOTBALL_DATA_API_KEY`: van [football-data.org](https://www.football-data.org/) (gratis)
   - Google Calendar velden: zie sectie hieronder
3. Klik op **Opslaan** en daarna **Starten**

### Stap 4: Dashboard openen
De addon verschijnt automatisch als **Planner** in het HA zijmenu (via Ingress).

---

## Google Calendar koppelen

De Google OAuth redirect URI moet wijzen naar jouw HA-installatie. Gebruik:

```
http://homeassistant.local:4310/auth/google/callback
```

Of als je HA extern bereikbaar is:
```
https://jouw-ha-domein.duckdns.org/api/hassio_ingress/.../auth/google/callback
```

> **Let op:** De makkelijkste optie is het lokale IP. Stel in Google Cloud Console in als toegestane redirect URI.

---

## Persistent data
Caches (sports, Google tokens) worden opgeslagen in `/data` — dit blijft bewaard bij herstart en updates.

## Home Assistant connectie
De addon praat direct met de HA API via de interne Supervisor-verbinding. Je hoeft geen aparte token in te vullen.
