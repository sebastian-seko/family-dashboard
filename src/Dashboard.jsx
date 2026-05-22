import React, { useState, useEffect } from 'react';
import { Cloud, CloudRain, CloudSnow, Sun, Wind } from 'lucide-react';

const FamilyDashboard = () => {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState(null);
  const [events, setEvents] = useState([]);
  const [backgroundImage, setBackgroundImage] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch('/api/weather');
        const data = await response.json();
        setWeather(data);
      } catch (error) {
        console.error('Weather fetch error:', error);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 1800000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchBackground = async () => {
      try {
        const response = await fetch('/api/backgrounds');
        const { images } = await response.json();
        if (images && images.length > 0) {
          const randomImage = images[Math.floor(Math.random() * images.length)];
          setBackgroundImage(`/backgrounds/${randomImage}`);
        }
      } catch (error) {
        console.error('Background fetch error:', error);
      }
    };

    fetchBackground();
    const interval = setInterval(fetchBackground, 300000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/calendar');
        const data = await response.json();
        setEvents(data.events || []);
      } catch (error) {
        console.error('Calendar fetch error:', error);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 300000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatSeconds = (date) => {
    return date.toLocaleTimeString('pl-PL', { second: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatDayName = (date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('pl-PL', { weekday: 'short' }).toUpperCase();
  };

  const getWeatherIcon = (iconCode) => {
    if (!iconCode) return <Cloud className="w-12 h-12" />;
    
    if (iconCode.includes('01')) return <Sun className="w-12 h-12" />;
    if (iconCode.includes('09') || iconCode.includes('10')) return <CloudRain className="w-12 h-12" />;
    if (iconCode.includes('13')) return <CloudSnow className="w-12 h-12" />;
    if (iconCode.includes('50')) return <Wind className="w-12 h-12" />;
    return <Cloud className="w-12 h-12" />;
  };

  const groupEventsByDay = () => {
    const grouped = {};
    const today = new Date();
    
    // Znajdź poniedziałek obecnego tygodnia
    const currentDay = today.getDay(); // 0 = niedziela, 1 = poniedziałek, ...
    const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay; // Jeśli niedziela, cofnij o 6 dni
    const monday = new Date(today);
    monday.setDate(today.getDate() + daysToMonday);
    monday.setHours(0, 0, 0, 0);
    
    // Stwórz 14 dni (2 tygodnie) od poniedziałku
    for (let i = 0; i < 14; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const key = date.toLocaleDateString('pl-PL');
      grouped[key] = {
        date,
        events: [],
        isToday: date.toDateString() === today.toDateString()
      };
    }

    events.forEach(event => {
      const eventDate = new Date(event.start);
      const key = eventDate.toLocaleDateString('pl-PL');
      if (grouped[key]) {
        grouped[key].events.push(event);
      }
    });

    return Object.values(grouped);
  };

  const dayGroups = groupEventsByDay();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {backgroundImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${backgroundImage})`,
            filter: 'brightness(0.7)'
          }}
        />
      )}
      
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

      <div className="relative z-10 h-full flex flex-col p-8">
        
        <div className="flex justify-between items-start mb-12">
          
          <div className="text-white">
            <div className="flex items-baseline">
              <span className="text-9xl font-thin tracking-tight">
                {formatTime(time)}
              </span>
              <span className="text-5xl font-thin ml-2 opacity-70">
                {formatSeconds(time)}
              </span>
            </div>
            <div className="text-2xl font-light mt-2 opacity-90">
              {formatDate(time)}
            </div>
          </div>

          <div className="text-white text-right">
            <div className="flex items-center justify-end gap-4 mb-6">
              <span className="text-7xl font-thin">
                {weather?.current || 0}°
              </span>
              <div className="opacity-80">
                {getWeatherIcon(weather?.icon)}
              </div>
            </div>

            <div className="flex gap-6">
              {weather?.forecast?.map((day, idx) => {
                const dayDate = typeof day.date === 'string' ? new Date(day.date) : day.date;
                return (
                  <div key={idx} className="text-center">
                    <div className="text-sm font-medium opacity-70 mb-2">
                      {formatDayName(dayDate)}
                    </div>
                    <div className="opacity-60 mb-2 flex justify-center">
                      {getWeatherIcon(day.icon)}
                    </div>
                    <div className="text-lg">
                      <span className="opacity-60">{day.min}</span>
                      <span className="mx-1 opacity-40">-</span>
                      <span>{day.max}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-7 gap-4 overflow-hidden">
          {dayGroups.map((dayGroup, idx) => (
            <div key={idx} className="flex flex-col">
              <div className={`text-white text-base font-light mb-3 ${dayGroup.isToday ? 'font-bold text-yellow-400' : 'opacity-80'}`}>
                <div className="text-xs opacity-70 mb-1">{formatDayName(dayGroup.date)}</div>
                <div>{dayGroup.date.getDate()}.{(dayGroup.date.getMonth() + 1).toString().padStart(2, '0')}</div>
              </div>

              <div className="space-y-2 overflow-y-auto pr-1">
                {dayGroup.events.map((event, eventIdx) => (
                  <div 
                    key={eventIdx}
                    className="bg-white/10 backdrop-blur-sm rounded p-2 border-l-4 text-xs"
                    style={{ borderLeftColor: event.color || '#ffffff' }}
                  >
                    <div className="text-white">
                      <div className="text-xs opacity-70 mb-1">
                        {event.allDay ? 'Cały dzień' : new Date(event.start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="font-medium text-sm mb-0.5 leading-tight">
                        {event.title}
                      </div>
                      {event.location && (
                        <div className="text-xs opacity-60 truncate">
                          {event.location}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {dayGroup.events.length === 0 && (
                  <div className="text-white/30 text-xs italic">
                    Brak
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FamilyDashboard;