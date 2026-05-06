import { useState, useEffect, useCallback } from 'react';

// Optimized base64 encoded notification sounds (short & clean)
// Success: Pleasant upward chime
const SUCCESS_SOUND = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YREAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // Placeholder
// Warning: Subtle alert
const WARNING_SOUND = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YREAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // Placeholder
// Error: Low tone alert
const ERROR_SOUND = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YREAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // Placeholder
// Info: Neutral notification
const INFO_SOUND = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YREAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // Placeholder

export type NotificationType = 'success' | 'warning' | 'error' | 'info';

interface AudioPreferences {
  muted: boolean;
  volume: number; // 0.0 to 1.0
}

export const useAudioNotification = () => {
  const [preferences, setPreferences] = useState<AudioPreferences>(() => {
    const saved = localStorage.getItem('invo_audio_prefs');
    return saved ? JSON.parse(saved) : { muted: false, volume: 0.5 };
  });

  useEffect(() => {
    localStorage.setItem('invo_audio_prefs', JSON.stringify(preferences));
  }, [preferences]);

  const playNotification = useCallback((type: NotificationType) => {
    if (preferences.muted) return;

    let soundSrc = INFO_SOUND;
    switch (type) {
      case 'success': soundSrc = SUCCESS_SOUND; break;
      case 'warning': soundSrc = WARNING_SOUND; break;
      case 'error': soundSrc = ERROR_SOUND; break;
      case 'info': soundSrc = INFO_SOUND; break;
    }

    const audio = new Audio(soundSrc);
    audio.volume = preferences.volume;
    
    // Fallback for browsers with playback restrictions (user must interact first)
    audio.play().catch(err => {
      console.warn('Audio playback prevented by browser:', err);
    });
  }, [preferences]);

  const toggleMute = () => setPreferences(prev => ({ ...prev, muted: !prev.muted }));
  const setVolume = (v: number) => setPreferences(prev => ({ ...prev, volume: Math.max(0, Math.min(1, v)) }));

  return { playNotification, preferences, toggleMute, setVolume };
};
