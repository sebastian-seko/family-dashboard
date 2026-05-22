import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import ical from 'node-ical';
import { fileURLToPath } from 'url';
import { createDAVClient } from 'tsdav';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
  WEATHER_API_KEY: process.env.WEATHER_API_KEY || '',
  WEATHER_LAT: process.env.WEATHER_LAT || '50.3475',
  WEATHER_LON: process.env.WEATHER_LON || '18.9384',
  ICLOUD_USER: process.env.ICLOUD_USER || '',
  ICLOUD_PASS: process.env.ICLOUD_PASS || '',
  TIMEZONE: process.env.TIMEZONE || 'Europe/Warsaw'
};

app.use(express.static('dist'));

app.get('/api/backgrounds', async (req, res) => {
  try {
    const backgroundsPath = process.env.BACKGROUNDS_PATH || path.join(__dirname, 'backgrounds');
    const files = await fs.readdir(backgroundsPath);
    const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    res.json({ images });
  } catch (error) {
    res.json({ images: [] });
  }
});

app.use('/backgrounds', express.static(process.env.BACKGROUNDS_PATH || path.join(__dirname, 'backgrounds')));

app.get('/api/weather', async (req, res) => {
  try {
    if (!CONFIG.WEATHER_API_KEY) {
      return res.json({ current: 0, icon: '01d', forecast: [] });
    }

    const currentUrl = `https://api.weather.com/v3/wx/observations/current`;
    const forecastUrl = `https://api.weather.com/v3/wx/forecast/daily/5day`;

    const params = {
      geocode: `${CONFIG.WEATHER_LAT},${CONFIG.WEATHER_LON}`,
      units: 'm',
      language: 'pl-PL',
      format: 'json',
      apiKey: CONFIG.WEATHER_API_KEY
    };

    const [currentResponse, forecastResponse] = await Promise.all([
      axios.get(currentUrl, { params }),
      axios.get(forecastUrl, { params })
    ]);

    const current = currentResponse.data;
    const forecast = forecastResponse.data;

    const mapIcon = (code) => {
      if (!code) return '01d';
      const c = parseInt(code);
      if (c >= 1 && c <= 4) return '01d';
      if (c >= 5 && c <= 11) return '02d';
      if (c >= 12 && c <= 18) return '09d';
      if (c >= 19 && c <= 22) return '13d';
      if (c >= 23 && c <= 30) return '50d';
      if (c >= 31 && c <= 34) return '01n';
      if (c >= 35 && c <= 38) return '02n';
      return '02d';
    };

    const forecastData = [];
    for (let i = 0; i < 5 && i < forecast.dayOfWeek.length; i++) {
      forecastData.push({
        date: new Date(forecast.validTimeLocal[i]).toISOString(),
        min: Math.round(forecast.temperatureMin[i]),
        max: Math.round(forecast.temperatureMax[i]),
        icon: mapIcon(forecast.daypart[0].iconCode[i * 2]),
        description: forecast.narrative[i] || ''
      });
    }

    res.json({
      current: Math.round(current.temperature),
      icon: mapIcon(current.iconCode),
      forecast: forecastData
    });

  } catch (error) {
    console.error('Weather API error:', error.response?.status, error.message);
    res.json({ current: 0, icon: '01d', forecast: [] });
  }
});

function parseEventDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;

  if (typeof dateValue === 'string' && /^\d{8}$/.test(dateValue)) {
    const year = parseInt(dateValue.substring(0, 4));
    const month = parseInt(dateValue.substring(4, 6)) - 1;
    const day = parseInt(dateValue.substring(6, 8));
    return new Date(year, month, day, 0, 0, 0);
  }

  if (typeof dateValue === 'string') return new Date(dateValue);
  if (dateValue.val) return new Date(dateValue.val);

  return new Date(dateValue);
}

function isAllDayEvent(event) {
  if (event.datetype === 'date') return true;
  if (event.start?.dateOnly === true) return true;

  const startDate = parseEventDate(event.start);
  const endDate = parseEventDate(event.end);

  if (startDate && endDate) {
    const duration = endDate.getTime() - startDate.getTime();
    const isDayDuration = duration % (24 * 60 * 60 * 1000) === 0;
    const startsAtMidnight = startDate.getHours() === 0 &&
                             startDate.getMinutes() === 0 &&
                             startDate.getSeconds() === 0;
    if (isDayDuration && startsAtMidnight) return true;
  }

  if (typeof event.start === 'string' && /^\d{8}$/.test(event.start)) return true;

  if (!event.start?.tz && !event.end?.tz) {
    if (startDate && endDate) {
      const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      if (hours >= 24 && startDate.getHours() === 0) return true;
    }
  }

  return false;
}

function isBirthdayCalendar(calendar) {
  const name = (calendar.displayName || '').toLowerCase();
  return name.includes('birthday') || name.includes('urodzin');
}

function expandRecurringEvents(event, rangeStart, rangeEnd) {
  if (!event.rrule) return [event];

  try {
    const startDate = parseEventDate(event.start);
    let endDate = parseEventDate(event.end);

    if (!startDate) return [];

    // Birthday events use DURATION:P1D instead of DTEND
    if (!endDate) {
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const duration = endDate.getTime() - startDate.getTime();
    const occurrences = [];

    if (event.rrule.between) {
      const dates = event.rrule.between(rangeStart, rangeEnd, true);
      dates.forEach(date => {
        const occurrenceStart = new Date(date);
        const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
        occurrences.push({
          ...event,
          start: occurrenceStart,
          end: occurrenceEnd,
          recurrenceId: occurrenceStart.toISOString()
        });
      });
    } else {
      const freq = event.rrule.freq || event.rrule.options?.freq;
      const interval = event.rrule.interval || event.rrule.options?.interval || 1;
      let current = new Date(startDate);

      // For yearly events (birthdays), jump directly to the relevant year
      // instead of iterating year by year from the birth year
      if (freq === 'YEARLY' || freq === 0) {
        const yearsDiff = rangeStart.getFullYear() - current.getFullYear();
        if (yearsDiff > 0) {
          current.setFullYear(current.getFullYear() + Math.floor(yearsDiff / interval) * interval);
        }
      }

      let count = 0;

      while (current <= rangeEnd && count < 100) {
        if (current >= rangeStart) {
          occurrences.push({
            ...event,
            start: new Date(current),
            end: new Date(current.getTime() + duration),
            recurrenceId: current.toISOString()
          });
        }

        if (freq === 'WEEKLY' || freq === 3) {
          current.setDate(current.getDate() + (7 * interval));
        } else if (freq === 'DAILY' || freq === 4) {
          current.setDate(current.getDate() + interval);
        } else if (freq === 'MONTHLY' || freq === 2) {
          current.setMonth(current.getMonth() + interval);
        } else if (freq === 'YEARLY' || freq === 0) {
          current.setFullYear(current.getFullYear() + interval);
        } else {
          break;
        }
        count++;
      }
    }

    return occurrences;

  } catch (error) {
    console.error('Error expanding recurring event:', event.summary, error.message);
    return [event];
  }
}

app.get('/api/calendar', async (req, res) => {
  try {
    if (!CONFIG.ICLOUD_USER || !CONFIG.ICLOUD_PASS) {
      return res.json({ events: [] });
    }

    const allEvents = [];
    const now = new Date();

    const currentDay = now.getDay();
    const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysToMonday);
    monday.setHours(0, 0, 0, 0);

    const twoWeeksLater = new Date(monday);
    twoWeeksLater.setDate(monday.getDate() + 14);
    twoWeeksLater.setHours(23, 59, 59, 999);

    try {
      const client = await createDAVClient({
        serverUrl: 'https://caldav.icloud.com',
        credentials: {
          username: CONFIG.ICLOUD_USER,
          password: CONFIG.ICLOUD_PASS
        },
        authMethod: 'Basic',
        defaultAccountType: 'caldav'
      });

      const calendars = await client.fetchCalendars();

      for (const calendar of calendars) {
        try {
          const fetchOptions = { calendar };
          if (!isBirthdayCalendar(calendar)) {
            fetchOptions.timeRange = {
              start: monday.toISOString(),
              end: twoWeeksLater.toISOString()
            };
          }
          const calendarObjects = await client.fetchCalendarObjects(fetchOptions);

          for (const obj of calendarObjects) {
            try {
              const events = await ical.async.parseICS(obj.data);

              Object.values(events).forEach(event => {
                if (event.type === 'VEVENT') {
                  try {
                    const expandedEvents = expandRecurringEvents(event, monday, twoWeeksLater);

                    expandedEvents.forEach(expandedEvent => {
                      const startDate = parseEventDate(expandedEvent.start);
                      const endDate = parseEventDate(expandedEvent.end);

                      if (!startDate) return;

                      const startDay = new Date(startDate);
                      startDay.setHours(0, 0, 0, 0);

                      if (startDay >= monday && startDay <= twoWeeksLater) {
                        allEvents.push({
                          title: expandedEvent.summary || 'Bez tytułu',
                          start: startDate.toISOString(),
                          end: endDate ? endDate.toISOString() : startDate.toISOString(),
                          allDay: isAllDayEvent(expandedEvent),
                          location: expandedEvent.location || '',
                          description: expandedEvent.description || '',
                          calendar: calendar.displayName || 'Kalendarz',
                          color: calendar.calendarColor || '#4A90E2',
                          recurring: !!expandedEvent.rrule
                        });
                      }
                    });
                  } catch (eventError) {
                    console.error('Error processing event:', event.summary, eventError.message);
                  }
                }

                if (event.type === 'VTODO' && event.due && event.status !== 'COMPLETED') {
                  try {
                    const dueDate = parseEventDate(event.due);
                    if (dueDate) {
                      const dueDay = new Date(dueDate);
                      dueDay.setHours(0, 0, 0, 0);

                      if (dueDay >= monday && dueDay <= twoWeeksLater) {
                        allEvents.push({
                          title: `✓ ${event.summary || 'Zadanie'}`,
                          start: dueDate.toISOString(),
                          end: dueDate.toISOString(),
                          allDay: true,
                          location: '',
                          description: event.description || '',
                          calendar: 'Przypomnienia',
                          color: '#FF9500',
                          recurring: false
                        });
                      }
                    }
                  } catch (todoError) {
                    console.error('Error processing TODO:', event.summary, todoError.message);
                  }
                }
              });
            } catch (parseError) {
              console.error('Error parsing calendar object:', parseError.message);
            }
          }
        } catch (calError) {
          console.error(`Error fetching calendar ${calendar.displayName}:`, calError.message);
        }
      }

      allEvents.sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return new Date(a.start) - new Date(b.start);
      });

      res.json({ events: allEvents });

    } catch (davError) {
      console.error('DAV Client error:', davError.message);
      res.json({ events: [] });
    }

  } catch (error) {
    console.error('Calendar error:', error.message);
    res.json({ events: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
  console.log(`Weather API: ${CONFIG.WEATHER_API_KEY ? 'configured' : 'not configured'}`);
  console.log(`iCloud: ${CONFIG.ICLOUD_USER ? 'configured' : 'not configured'}`);
});
