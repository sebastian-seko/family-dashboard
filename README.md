# Family Dashboard

Dashboard rodzinny wyświetlający zegar, pogodę i kalendarz iCloud. Zbudowany na Node.js + React + Vite, uruchamiany w Dockerze.

## Wymagania

- Docker

## Uruchomienie

```bash
docker run -d \
  -e WEATHER_API_KEY=twoj_klucz \
  -e WEATHER_LAT=50.3475 \
  -e WEATHER_LON=18.9384 \
  -e ICLOUD_USER=twoj@email.com \
  -e ICLOUD_PASS=twoje-haslo-aplikacji \
  -v /sciezka/do/zdjec:/app/backgrounds:ro \
  -p 3000:3000 \
  --restart unless-stopped \
  nazwa-obrazu
```

Lub bezpośrednio z GitHub (publiczne repo):

```bash
docker run -d \
  -e WEATHER_API_KEY=twoj_klucz \
  ... \
  $(docker build -q https://github.com/TWOJ_USER/family-dashboard.git)
```

Dashboard dostępny pod: `http://localhost:3000`

## Zmienne środowiskowe

| Zmienna | Wymagana | Opis |
|---|---|---|
| `WEATHER_API_KEY` | tak | Klucz API Weather.com (weather.com/api) |
| `WEATHER_LAT` | nie | Szerokość geograficzna (domyślnie: `50.3475`) |
| `WEATHER_LON` | nie | Długość geograficzna (domyślnie: `18.9384`) |
| `ICLOUD_USER` | tak | Adres e-mail konta Apple/iCloud |
| `ICLOUD_PASS` | tak | Hasło aplikacji iCloud (nie hasło do konta Apple) |
| `TIMEZONE` | nie | Strefa czasowa (domyślnie: `Europe/Warsaw`) |
| `BACKGROUNDS_PATH` | nie | Ścieżka do folderu ze zdjęciami tła (domyślnie: `./backgrounds`) |
| `PORT` | nie | Port serwera (domyślnie: `3000`) |

## Konfiguracja kluczy

### Weather.com API

1. Zarejestruj się na [weather.com/api](https://weather.com/api)
2. Skopiuj klucz API i podaj go jako `WEATHER_API_KEY`

Alternatywnie: [Visual Crossing](https://www.visualcrossing.com/weather-api) — 1000 zapytań/dzień za darmo, bez karty kredytowej (wymaga dostosowania kodu w `server.js`).

### Hasło aplikacji iCloud

Hasło aplikacji to **oddzielne hasło** generowane przez Apple — nie używaj hasła do konta Apple ID.

1. Zaloguj się na [appleid.apple.com](https://appleid.apple.com)
2. Przejdź do sekcji **Bezpieczeństwo → Hasła do aplikacji**
3. Wygeneruj nowe hasło (format: `xxxx-xxxx-xxxx-xxxx`)
4. Podaj je jako `ICLOUD_PASS`

## Tła

Umieść zdjęcia (JPG, PNG, WEBP) w folderze i podlinkuj go przez wolumen Docker:

```bash
-v /home/user/backgrounds:/app/backgrounds:ro
```

Dashboard losowo zmienia tło co 5 minut.

## Budowanie obrazu lokalnie

```bash
npm install
npm run build
docker build -t family-dashboard .
```

## Struktura projektu

```
├── src/              # Frontend React
│   ├── Dashboard.jsx
│   ├── main.jsx
│   └── index.css
├── server.js         # Backend Express (API pogody, kalendarza, tła)
├── Dockerfile        # Multi-stage build
├── .env.example      # Szablon zmiennych środowiskowych
└── backgrounds/      # Folder na zdjęcia tła (nie commitować)
```
