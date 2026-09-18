/**
 * Format duration in seconds to a clean readable string (e.g. 600 -> "10:00", 90 -> "1:30")
 */
export function formatSecondsToTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse time string (e.g. "10:00", "90", "1:30", "10 min") to seconds
 */
export function parseTimeToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Check if it's purely digits
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // Check MM:SS or H:MM:SS
  const parts = trimmed.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    if (!isNaN(mins) && !isNaN(secs)) {
      return mins * 60 + secs;
    }
  } else if (parts.length === 3) {
    const hrs = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    const secs = parseInt(parts[2], 10);
    if (!isNaN(hrs) && !isNaN(mins) && !isNaN(secs)) {
      return hrs * 3600 + mins * 60 + secs;
    }
  }

  return null;
}

/**
 * Format meters into human-readable distance (e.g. 1000 -> "1.00 km", 800 -> "800 m", 5000 -> "5.00 km")
 */
export function formatMetersToDistance(meters: number): string {
  if (isNaN(meters) || meters < 0) return '0 m';
  if (meters >= 1000) {
    const km = meters / 1000;
    // Format nicely without trailing zeros if integer, or with 2 decimals
    return Number.isInteger(km) ? `${km.toFixed(2)} km` : `${km.toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Parse distance string (e.g. "1.5 km", "1.5", "800 m", "800") into meters
 */
export function parseDistanceToMeters(input: string, defaultUnit: 'km' | 'm' = 'km'): number | null {
  const trimmed = input.trim().toLowerCase().replace(',', '.');
  if (!trimmed) return null;

  const match = trimmed.match(/^([\d.]+)\s*(km|км|m|м)?$/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (isNaN(value) || value <= 0) return null;

  const unit = match[2];
  if (unit === 'km' || unit === 'км' || (!unit && defaultUnit === 'km' && value < 100)) {
    return Math.round(value * 1000);
  }
  return Math.round(value);
}

/**
 * Convert pace string "M:SS" or "MM:SS" to seconds per km
 */
export function paceToSeconds(paceStr: string): number | null {
  if (!paceStr) return null;
  const match = paceStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const min = parseInt(match[1], 10);
  const sec = parseInt(match[2], 10);
  if (sec >= 60) return null;
  return min * 60 + sec;
}

/**
 * Validate pace format (e.g. "4:50", "05:00")
 */
export function isValidPace(paceStr: string): boolean {
  if (!paceStr) return false;
  return paceToSeconds(paceStr) !== null;
}

/**
 * Today's date in YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
