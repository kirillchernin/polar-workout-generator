import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import {
  resolveWorkoutTitle,
  extractExplicitTitle,
  classifyWorkoutTitle,
  sanitizeEnglishTitle,
} from './src/utils/workoutTitle.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is not set. Requests will fail if key is missing.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

const VALID_INTENSITIES = [
  'none',
  'easy',
  'recovery',
  'threshold',
  'tempo',
  'marathon_pace',
  'pace',
  'heart_rate',
  'speed',
] as const;

const WORKOUT_PROMPT_SYSTEM = `You are a precision parser for Polar Flow Phased Target running workouts.
Your goal is to convert plain text running workout descriptions (in English or Russian, including structured formats from apps like Runna) into a strictly validated JSON structure compatible with Polar Flow Phased Target logic.

--------------------------------------------------
1. STRUCTURED / RUNNA-STYLE TEXT PARSING RULES
--------------------------------------------------
- REPEAT BLOCKS:
  - Recognize patterns like "Repeat the following 5x:", "Repeat 5x:", "Repeat 5 times:" as a repeat block with repetitions: 5.
  - Lines between separators (e.g. "----------", "------", "***", "===") belong to that repeat block.
  - Separators such as "-----" must be completely ignored and NEVER become phases.
  - CRITICAL BOUNDARY RULE: Any lines AFTER the closing separator of a repeat block (e.g. "90s walking rest") are STRICTLY OUTSIDE the repeat block! DO NOT put them inside the repeat block.
- HEADER TITLES:
  - Top header lines such as "Rolling 400s with Runna" or workout titles must become the workout "name" and must NEVER become workout phases.
- FOOTER & METADATA TEXT:
  - Footer lines such as plan name, week number, race name or app branding (e.g. "Medio Maratón Valencia Trinidad Alfonso Zurich Plan (Week /8)", "Week 3/8", "Garmin Coach Plan") must be COMPLETELY IGNORED and must NEVER become workout phases.
- TIME & DISTANCE SHORTHANDS:
  - "90s" = 90 seconds. "30s" = 30 seconds. "2m" / "2min" = 120 seconds.
  - "2km" = 2000 meters. "400m" = 400 meters.
- WALKING REST & CONVERSATIONAL PACE:
  - "walking rest" means recovery (durationType: "time", qualitative meaning: recovery).
  - "conversational pace", "easy", "easy pace" must use the user's Easy mapping.
  - Interpret parenthetical instructions (e.g. "(no faster than 6:15/km)", "(or slower!)").

--------------------------------------------------
2. PHASE NAMES MUST INCLUDE THE TARGET
--------------------------------------------------
- When a phase contains an explicit pace, include that pace in the phase name:
  - "400m at 5:15/km" -> phase name: "400m @ 5:15/km"
  - "400m at 5:55/km" -> phase name: "400m @ 5:55/km"
  - "2km warm up at a conversational pace (no faster than 6:15/km)" -> phase name: "Warm up ≤ 6:15/km"
  - "90s walking rest" -> phase name: "Walking recovery 1:30"
  - "2km cool down at a conversational pace (or slower!)" -> phase name: "Cool down"
- The phase name must remain short enough for Polar (maximum 45 characters).
- For time phases, include the time in the phase name when useful:
  "Recovery 1:30", "Tempo 10:00", "Walking recovery 1:30".
- For distance + explicit pace, prioritize: "<distance> @ <pace>" (e.g. "800m @ 4:45/km", "400m @ 5:15/km").
- Do NOT duplicate information unnecessarily.

--------------------------------------------------
3. WORK PHASE CLASSIFICATION & POLAR ZONE RULES
--------------------------------------------------
- WORK PHASES:
  - A phase should be considered WORK when it is part of an interval/repetition workout and represents the faster or effort portion (interval, repetition, rep, fast, hard, threshold, or effort portions inside repeat blocks such as 400m, 800m, 1km reps).
  - Recovery, walking rest, warm-up and cool-down are NOT work phases.
- POLAR ZONE RULE FOR WORK PHASES:
  - For Polar export, all WORK phases must have an upper Pace zone of AT LEAST Z4, unless the user explicitly specifies another Polar zone.
  - All Polar training zone ranges ALWAYS start at Zone 1 (zoneMin is ALWAYS 1).
  - WORK phase default: intensityType: "speed", zoneMin: 1, zoneMax: 4 (or 5 if user default intervals is 5).
  - If another rule would produce Pace Z1-Z2 or Pace Z1-Z3 for a WORK phase, upgrade it to: Pace Z1-Z4.
  - Do NOT automatically upgrade recovery, warm-up or cool-down.
  - Explicit Polar zone instructions always override this rule.
- PRESERVE EXPLICIT PACE IN METADATA:
  - When a WORK phase has an explicit pace (such as "400m at 5:15/km"):
    - Retain paceMin: "5:15", paceMax: "5:15".
    - Phase name: "400m @ 5:15/km".
    - Polar target: intensityType: "speed", zoneMin: 1, zoneMax: 4.
    - (This keeps the prescribed pace visible on the watch via the phase name while Polar tracks the cumulative zone target).
- CONVERSATIONAL PACE WITH LIMIT:
  - "conversational pace, no faster than 6:15/km" -> retain "≤ 6:15/km" in the phase name ("Warm up ≤ 6:15/km"), but do NOT classify as WORK. Use the Easy Polar zone mapping.
- WALKING REST:
  - Walking rest must be classified as recovery.
  - "90s walking rest" -> durationType: "time", duration: 90, qualitative: recovery, use Recovery mapping, phase name: "Walking recovery 1:30".

--------------------------------------------------
4. PRIORITY ORDER
--------------------------------------------------
1. Explicit Polar zone (always starts at Zone 1, e.g. HR Z1-Z3, Pace Z1-Z4). Explicit Polar zone always wins!
2. Explicit workout structure/repeat (e.g. repeat blocks with separators).
3. Explicit pace (retain paceMin/paceMax in metadata AND in phase name).
4. Work-phase classification (Pace Z1-Z4 minimum for work phases).
5. Qualitative intensity mapping (Easy, Recovery, Tempo, Threshold, Intervals mapped to user settings).
6. No target ("none", "free pace").

All zoneMin values MUST be 1. The generator must NEVER generate zoneMin greater than 1!
No Power fields.
Store time in SECONDS (number). E.g. 10 min = 600, 90s = 90, 2 min = 120.
Store distance in METERS (number). E.g. 2 km = 2000, 400 m = 400, 1 km = 1000.

JSON STRUCTURE:
You must return a JSON object with this exact structure:
{
  "name": string,
  "sport": "running",
  "date": "YYYY-MM-DD",
  "startTime": "08:00", // Always "08:00"
  "warnings": string[],
  "phases": [
    // Array of Phase objects OR RepeatBlock objects
  ]
}

Phase object:
{
  "type": "phase",
  "name": string, // Max 45 chars, e.g. "Warm up ≤ 6:15/km", "400m @ 5:15/km", "Walking recovery 1:30"
  "durationType": "time" | "distance",
  "duration": number, // seconds or meters
  "intensityType": "none" | "easy" | "recovery" | "threshold" | "tempo" | "marathon_pace" | "pace" | "heart_rate" | "speed",
  "zoneMin"?: 1, // ALWAYS 1 if speed or heart_rate
  "zoneMax"?: number, // 1-5 if speed or heart_rate
  "paceMin"?: string, // e.g. "5:15"
  "paceMax"?: string, // e.g. "5:15"
  "hrMin"?: number,
  "hrMax"?: number
}

RepeatBlock object:
{
  "type": "repeat",
  "repetitions": number,
  "phases": [
    // Array of Phase objects
  ]
}

EXAMPLES:

Input:
"""
Rolling 400s with Runna

2km warm up at a conversational pace (no faster than 6:15/km)

Repeat the following 5x:
----------
400m at 5:15/km
400m at 5:55/km
----------

90s walking rest

2km cool down at a conversational pace (or slower!)

Medio Maratón Valencia Trinidad Alfonso Zurich Plan (Week /8)
"""
Output:
{
  "name": "Rolling 400s with Runna",
  "sport": "running",
  "date": "2026-09-14",
  "warnings": [],
  "phases": [
    {
      "type": "phase",
      "name": "Warm up ≤ 6:15/km",
      "durationType": "distance",
      "duration": 2000,
      "intensityType": "easy"
    },
    {
      "type": "repeat",
      "repetitions": 5,
      "phases": [
        {
          "type": "phase",
          "name": "400m @ 5:15/km",
          "durationType": "distance",
          "duration": 400,
          "intensityType": "speed",
          "zoneMin": 1,
          "zoneMax": 4,
          "paceMin": "5:15",
          "paceMax": "5:15"
        },
        {
          "type": "phase",
          "name": "400m @ 5:55/km",
          "durationType": "distance",
          "duration": 400,
          "intensityType": "speed",
          "zoneMin": 1,
          "zoneMax": 4,
          "paceMin": "5:55",
          "paceMax": "5:55"
        }
      ]
    },
    {
      "type": "phase",
      "name": "Walking recovery 1:30",
      "durationType": "time",
      "duration": 90,
      "intensityType": "recovery"
    },
    {
      "type": "phase",
      "name": "Cool down",
      "durationType": "distance",
      "duration": 2000,
      "intensityType": "easy"
    }
  ]
}

Input: "15 min easy, then 4 x 5 min threshold with 2 min jog recovery"
Output:
{
  "name": "Threshold 4x5 min",
  "sport": "running",
  "date": "2026-09-14",
  "warnings": [],
  "phases": [
    {
      "type": "phase",
      "name": "Warm up",
      "durationType": "time",
      "duration": 900,
      "intensityType": "easy"
    },
    {
      "type": "repeat",
      "repetitions": 4,
      "phases": [
        {
          "type": "phase",
          "name": "Threshold 5:00",
          "durationType": "time",
          "duration": 300,
          "intensityType": "speed",
          "zoneMin": 1,
          "zoneMax": 4
        },
        {
          "type": "phase",
          "name": "Recovery 2:00",
          "durationType": "time",
          "duration": 120,
          "intensityType": "recovery"
        }
      ]
    }
  ]
}

Input: "5 km at 5:10/km"
Output:
{
  "name": "5 km @ 5:10/km",
  "sport": "running",
  "date": "2026-09-14",
  "warnings": [],
  "phases": [
    {
      "type": "phase",
      "name": "5km @ 5:10/km",
      "durationType": "distance",
      "duration": 5000,
      "intensityType": "pace",
      "paceMin": "5:10",
      "paceMax": "5:10"
    }
  ]
}

RETURN ONLY VALID JSON. No extra commentary outside the JSON.`;

function extractGeminiErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred while communicating with the AI service';

  // 1. If error is a string
  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      if (parsed.error?.message) return parsed.error.message;
      if (parsed.message) return parsed.message;
    } catch {}
    return error;
  }

  // 2. If message property is a string, check if it wraps JSON
  if (error.message && typeof error.message === 'string') {
    try {
      const start = error.message.indexOf('{');
      const end = error.message.lastIndexOf('}');
      if (start !== -1 && end > start) {
        const parsed = JSON.parse(error.message.slice(start, end + 1));
        if (parsed.error?.message) return parsed.error.message;
        if (parsed.message) return parsed.message;
      }
    } catch {}
    return error.message;
  }

  // 3. Direct nested error object
  if (error.error) {
    if (typeof error.error === 'string') return error.error;
    if (error.error.message) return error.error.message;
  }

  // 4. Status text
  if (error.status && error.statusText) {
    return `AI Service Error (${error.status}): ${error.statusText}`;
  }

  return error.toString() || 'Failed to communicate with AI service';
}

function validateWorkoutSchemaServer(data: any): { isValid: boolean; details: string[] } {
  const details: string[] = [];
  if (!data || typeof data !== 'object') {
    return { isValid: false, details: ['Root response is not an object'] };
  }
  if (!data.name || typeof data.name !== 'string') {
    details.push('Workout name is missing');
  }
  if (!Array.isArray(data.phases) || data.phases.length === 0) {
    details.push('Workout phases must be a non-empty array');
    return { isValid: false, details };
  }

  data.phases.forEach((item: any, idx: number) => {
    const prefix = `Phase #${idx + 1}`;
    if (!item || typeof item !== 'object') {
      details.push(`${prefix} is not an object`);
      return;
    }
    if (item.type === 'repeat') {
      if (typeof item.repetitions !== 'number' || item.repetitions < 1) {
        details.push(`${prefix} (Repeat): repetitions must be a positive integer`);
      }
      if (!Array.isArray(item.phases) || item.phases.length === 0) {
        details.push(`${prefix} (Repeat): phases list is empty`);
      } else {
        item.phases.forEach((sub: any, subIdx: number) => {
          checkPhaseObj(sub, `${prefix} sub #${subIdx + 1}`, details);
        });
      }
    } else if (item.type === 'phase') {
      checkPhaseObj(item, prefix, details);
    } else {
      details.push(`${prefix}: unknown type "${item.type}"`);
    }
  });

  return { isValid: details.length === 0, details };
}

function checkPhaseObj(phase: any, prefix: string, details: string[]) {
  if (!phase || typeof phase !== 'object') {
    details.push(`${prefix} is not an object`);
    return;
  }
  if (!phase.name || typeof phase.name !== 'string') {
    details.push(`${prefix}: name is required`);
  }
  if (phase.durationType !== 'time' && phase.durationType !== 'distance') {
    details.push(`${prefix}: durationType must be "time" or "distance"`);
  }
  if (typeof phase.duration !== 'number' || isNaN(phase.duration) || phase.duration <= 0) {
    details.push(`${prefix}: duration must be a positive number`);
  }
  if (!VALID_INTENSITIES.includes(phase.intensityType)) {
    details.push(`${prefix}: invalid intensityType "${phase.intensityType}"`);
  }
}

async function callGemini(contents: string): Promise<string> {
  const ai = getAi();
  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    let attempt = 0;
    const maxRetries = 2;
    while (attempt < maxRetries) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: WORKOUT_PROMPT_SYSTEM,
            responseMimeType: 'application/json',
          },
        });
        const text = response.text?.trim();
        if (text) {
          return text;
        }
        throw new Error('Gemini returned an empty response text');
      } catch (err: any) {
        attempt++;
        lastError = err;
        const errStr = JSON.stringify(err?.message || err);
        const isTransient =
          errStr.includes('503') ||
          errStr.includes('UNAVAILABLE') ||
          errStr.includes('429') ||
          errStr.includes('high demand') ||
          err?.status === 503 ||
          err?.status === 429;

        console.warn(`[Gemini] Model ${model} attempt ${attempt} error:`, err?.message || err);

        if (!isTransient || attempt >= maxRetries) {
          break;
        }
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }

  throw lastError || new Error('All AI models failed to generate a response');
}

interface ZoneSettingServer {
  intensityType: 'heart_rate' | 'speed';
  zoneMax: number;
}

type DefaultIntensityServer = Record<string, string | ZoneSettingServer>;

function formatZoneChoiceForPrompt(setting: any, fallbackStr: string): string {
  if (!setting) return fallbackStr;
  if (typeof setting === 'string') return setting;
  if (typeof setting === 'object' && setting.zoneMax) {
    const prefix = setting.intensityType === 'speed' ? 'Pace' : 'HR';
    return setting.zoneMax === 1 ? `${prefix} Z1` : `${prefix} Z1–Z${setting.zoneMax}`;
  }
  return fallbackStr;
}

function parseZoneChoiceServer(choice: any): { intensityType: 'heart_rate' | 'speed'; zoneMin: 1; zoneMax: number } {
  if (!choice) {
    return { intensityType: 'heart_rate', zoneMin: 1, zoneMax: 2 };
  }
  if (typeof choice === 'object') {
    const intensityType: 'heart_rate' | 'speed' = choice.intensityType === 'speed' ? 'speed' : 'heart_rate';
    const parsedMax =
      typeof choice.zoneMax === 'number'
        ? choice.zoneMax
        : typeof choice.zoneMin === 'number'
        ? choice.zoneMin
        : 2;
    const max = Math.min(5, Math.max(1, Math.round(parsedMax)));
    return { intensityType, zoneMin: 1, zoneMax: max };
  }
  if (typeof choice === 'string') {
    const isHr = choice.toUpperCase().startsWith('HR');
    const intensityType: 'heart_rate' | 'speed' = isHr ? 'heart_rate' : 'speed';
    const matches = Array.from(choice.matchAll(/\d+/g)).map((m) => parseInt(m[0], 10));
    if (matches.length > 0) {
      const highest = Math.max(...matches);
      const max = Math.min(5, Math.max(1, highest));
      return { intensityType, zoneMin: 1, zoneMax: max };
    }
    return { intensityType, zoneMin: 1, zoneMax: 2 };
  }
  return { intensityType: 'heart_rate', zoneMin: 1, zoneMax: 2 };
}

function resolveQualitativeServer(term: string, mapping: DefaultIntensityServer): { intensityType: 'heart_rate' | 'speed'; zoneMin: 1; zoneMax: number } | null {
  const norm = (term || '').toLowerCase().trim();
  let choice: any;
  if (norm === 'easy' || norm === 'легко' || norm === 'разминка' || norm === 'заминка') {
    choice = mapping.easy;
  } else if (norm === 'recovery' || norm === 'восстановление' || norm === 'отдых') {
    choice = mapping.recovery;
  } else if (norm === 'tempo' || norm === 'темп' || norm === 'темповый') {
    choice = mapping.tempo;
  } else if (norm === 'threshold' || norm === 'порог' || norm === 'пано') {
    choice = mapping.threshold;
  } else if (norm === 'interval' || norm === 'intervals' || norm === 'интервал' || norm === 'интервалы') {
    choice = mapping.intervals;
  } else if (norm === 'marathon_pace') {
    choice = mapping.tempo;
  }

  if (choice) {
    return parseZoneChoiceServer(choice);
  }
  return null;
}

function formatDurationMinutesSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDistanceShort(meters: number): string {
  if (meters >= 1000 && meters % 1000 === 0) {
    return `${meters / 1000}km`;
  }
  if (meters >= 1000 && (meters % 100 === 0 || meters % 100 === 50)) {
    return `${(meters / 1000).toFixed(1).replace(/\.0$/, '')}km`;
  }
  return `${meters}m`;
}

function isWorkPhase(phase: any, isInsideRepeat: boolean): boolean {
  if (!phase || typeof phase !== 'object') return false;
  const name = (phase.name || '').toLowerCase();
  const intensity = (phase.intensityType || '').toLowerCase();

  // Recovery, walking rest, warm-up and cool-down are NOT work phases
  if (
    name.includes('recovery') ||
    name.includes('walking') ||
    name.includes('rest') ||
    name.includes('отдых') ||
    name.includes('восстановление') ||
    name.includes('warm up') ||
    name.includes('warm-up') ||
    name.includes('warmup') ||
    name.includes('разминка') ||
    name.includes('cool down') ||
    name.includes('cool-down') ||
    name.includes('cooldown') ||
    name.includes('заминка') ||
    name.includes('jog') ||
    name.includes('трусца') ||
    intensity === 'recovery' ||
    intensity === 'easy'
  ) {
    return false;
  }

  // Inside repeat blocks, any non-recovery/non-rest phase is considered WORK
  if (isInsideRepeat) {
    return true;
  }

  // Outside repeat block:
  if (
    name.includes('interval') ||
    name.includes('интервал') ||
    name.includes('work') ||
    name.includes('работа') ||
    name.includes('rep') ||
    name.includes('повтор') ||
    name.includes('fast') ||
    name.includes('быстро') ||
    name.includes('hard') ||
    name.includes('threshold') ||
    name.includes('порог') ||
    name.includes('пано') ||
    intensity === 'threshold' ||
    intensity === 'intervals'
  ) {
    return true;
  }

  return false;
}

function sanitizeEnglishString(text: string, fallback: string = 'Phase'): string {
  if (!text) return fallback;
  let s = text;
  s = s.replace(/разминк\w*/gi, 'Warm up');
  s = s.replace(/заминк\w*/gi, 'Cool down');
  s = s.replace(/восстановлен\w*/gi, 'Recovery');
  s = s.replace(/отдых\w*/gi, 'Recovery');
  s = s.replace(/интервал\w*/gi, 'Interval');
  s = s.replace(/темпов\w*|темп\w*/gi, 'Tempo');
  s = s.replace(/порог\w*|пано/gi, 'Threshold');
  s = s.replace(/ходьб\w*|шагом|шаг\w*/gi, 'Walk');
  s = s.replace(/бег\w*|трусц\w*|легк\w*/gi, 'Easy Run');
  s = s.replace(/км/gi, 'km');
  s = s.replace(/м(?![a-zа-я])/gi, 'm');
  s = s.replace(/мин\w*/gi, 'min');
  s = s.replace(/сек\w*/gi, 's');
  s = s.replace(/раз\b/gi, 'x');
  s = s.replace(/[а-яА-ЯёЁ]/g, ''); // Remove any remaining Cyrillic characters
  s = s.replace(/\s+/g, ' ').trim();
  return s || fallback;
}

function formatPhaseName(phase: any, isInsideRepeat: boolean, originalText: string): string {
  if (!phase || typeof phase !== 'object') return 'Phase';
  const rawOriginal = (phase.name || '').trim();
  const originalName = sanitizeEnglishString(rawOriginal, 'Phase');
  const lower = rawOriginal.toLowerCase();

  // 1. Warm up with pace limit:
  if (lower.includes('warm') || lower.includes('разминк')) {
    const limitMatch =
      rawOriginal.match(/([≤<=]|no faster than|не быстрее)\s*(\d+:\d\d(?:\/km)?)/i) ||
      originalText.match(/(?:warm\s*up|разминк)[^.\n]*?(?:no faster than|не быстрее|[≤<=])\s*(\d+:\d\d(?:\/km)?)/i);
    if (limitMatch) {
      const paceVal = limitMatch[limitMatch.length - 1].replace(/\/km$/i, '');
      return `Warm up ≤ ${paceVal}/km`;
    }
    return 'Warm up';
  }

  // 2. Cool down:
  if (lower.includes('cool') || lower.includes('заминк')) {
    return 'Cool down';
  }

  // 3. Walking rest / walking recovery:
  if (
    lower.includes('walk') ||
    lower.includes('шагом') ||
    (phase.intensityType === 'recovery' && /walking\s*rest/i.test(originalText))
  ) {
    if (phase.durationType === 'time' && typeof phase.duration === 'number') {
      return `Walking recovery ${formatDurationMinutesSeconds(phase.duration)}`;
    }
    return 'Walking recovery';
  }

  // 4. Recovery (time based):
  if (
    phase.intensityType === 'recovery' ||
    lower.includes('recovery') ||
    lower.includes('отдых') ||
    lower.includes('восстановление')
  ) {
    if (phase.durationType === 'time' && typeof phase.duration === 'number') {
      return `Recovery ${formatDurationMinutesSeconds(phase.duration)}`;
    }
    return 'Recovery';
  }

  // Check if explicit pace exists or is mentioned in the original name
  if (!phase.paceMin) {
    const paceMatch = rawOriginal.match(/(\d+:\d\d)(?:\/km)?/);
    if (paceMatch) {
      phase.paceMin = paceMatch[1];
      phase.paceMax = paceMatch[1];
    }
  }

  // 5. Phase with explicit pace (e.g. 400m @ 5:15/km):
  if (phase.paceMin) {
    const paceStr =
      phase.paceMax && phase.paceMax !== phase.paceMin
        ? `${phase.paceMin}-${phase.paceMax}/km`
        : `${phase.paceMin}/km`;
    if (phase.durationType === 'distance' && typeof phase.duration === 'number') {
      return `${formatDistanceShort(phase.duration)} @ ${paceStr}`;
    }
    if (phase.durationType === 'time' && typeof phase.duration === 'number') {
      return `${formatDurationMinutesSeconds(phase.duration)} @ ${paceStr}`;
    }
  }

  // 6. Time-based tempo or threshold without explicit pace:
  if (lower.includes('tempo') || lower.includes('темп')) {
    if (phase.durationType === 'time' && typeof phase.duration === 'number') {
      return `Tempo ${formatDurationMinutesSeconds(phase.duration)}`;
    }
    return 'Tempo';
  }

  if (lower.includes('threshold') || lower.includes('порог') || lower.includes('пано')) {
    if (phase.durationType === 'time' && typeof phase.duration === 'number') {
      return `Threshold ${formatDurationMinutesSeconds(phase.duration)}`;
    }
    return 'Threshold';
  }

  // 7. Distance interval (e.g. 400m work) without explicit pace:
  if (phase.durationType === 'distance' && typeof phase.duration === 'number' && isInsideRepeat) {
    if (!originalName || originalName.toLowerCase() === 'interval' || originalName.toLowerCase() === 'work') {
      return `${formatDistanceShort(phase.duration)} Work`;
    }
  }

  // Fallback: sanitized English name, trimmed to max 45 chars
  return (originalName || 'Phase').slice(0, 45);
}

function isFooterOrSeparatorItem(item: any): boolean {
  if (!item || typeof item !== 'object') return true;
  if (item.type === 'phase') {
    const name = (item.name || '').trim();
    if (/^[-_=*~]{3,}$/.test(name)) return true;
    if (/plan\s*\([^)]*week/i.test(name)) return true;
    if (/\bweek\s*(\/\d+|\d+\/\d+|\d+)\b/i.test(name) && !/\b(min|km|m|sec)\b/i.test(name)) return true;
    if (/zurich plan/i.test(name) || /valencia/i.test(name)) return true;
  }
  return false;
}

function fixRepeatSeparators(items: any[], originalText: string): any[] {
  // Check if originalText has repeat block with separators followed by rest/recovery:
  // e.g. Repeat the following 5x: \n ---------- \n 400m ... \n ---------- \n\n 90s walking rest
  const sepRegex = /repeat[^\n]*?(\d+)\s*x:?\s*[-_=*~]{3,}([\s\S]*?)[-_=*~]{3,}([\s\S]*)/i;
  const match = originalText.match(sepRegex);
  if (!match) return items;

  const afterClosingSep = match[3] || '';

  const result: any[] = [];
  items.forEach((item) => {
    if (item.type === 'repeat' && Array.isArray(item.phases)) {
      const insidePhases: any[] = [];
      const movedPhases: any[] = [];

      item.phases.forEach((p: any) => {
        const pName = (p.name || '').toLowerCase();
        const isAfter =
          (afterClosingSep.toLowerCase().includes('walking rest') && (pName.includes('walking') || pName.includes('rest'))) ||
          (afterClosingSep.toLowerCase().includes('walking recovery') && (pName.includes('walking') || pName.includes('recovery'))) ||
          (p.duration === 90 && afterClosingSep.includes('90s'));

        if (isAfter) {
          movedPhases.push(p);
        } else {
          insidePhases.push(p);
        }
      });

      result.push({
        ...item,
        phases: insidePhases,
      });
      movedPhases.forEach((mp) => result.push(mp));
    } else {
      result.push(item);
    }
  });

  return result;
}

function normalizePhasesWithZones(
  items: any[],
  mapping: DefaultIntensityServer,
  originalText: string,
  isInsideRepeat: boolean = false
): void {
  if (!Array.isArray(items)) return;

  items.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (item.type === 'repeat' && Array.isArray(item.phases)) {
      normalizePhasesWithZones(item.phases, mapping, originalText, true);
      return;
    }
    if (item.type === 'phase') {
      // Strip any power fields
      delete item.powerMin;
      delete item.powerMax;

      const isWork = isWorkPhase(item, isInsideRepeat);

      // Check if explicit pace is in item or name
      if (!item.paceMin) {
        const paceMatch = (item.name || '').match(/(\d+:\d\d)(?:\/km)?/);
        if (paceMatch) {
          item.paceMin = paceMatch[1];
          item.paceMax = paceMatch[1];
        }
      }

      if (isWork) {
        // WORK PHASE RULE:
        // For Polar export, all WORK phases must have an upper Pace zone of AT LEAST Z4.
        // If it has explicit pace, preserve paceMin/paceMax and set Polar speed Z1-Z4
        item.intensityType = 'speed';
        item.zoneMin = 1;
        const intervalsMax =
          typeof mapping.intervals === 'object' && mapping.intervals?.zoneMax
            ? mapping.intervals.zoneMax
            : 4;
        const currentMax = typeof item.zoneMax === 'number' ? item.zoneMax : 4;
        item.zoneMax = Math.max(4, Math.max(intervalsMax, currentMax));
      } else {
        // NON-WORK PHASES:
        // 1. If explicit numeric pace, keep it
        if (item.intensityType === 'pace') {
          // keep
        } else if (item.intensityType === 'speed') {
          // Explicit speed zone: ALWAYS start at Zone 1 (zoneMin: 1)
          const rawMax =
            typeof item.zoneMax === 'number'
              ? item.zoneMax
              : typeof item.zoneMin === 'number'
              ? item.zoneMin
              : 4;
          item.zoneMin = 1;
          item.zoneMax = Math.min(5, Math.max(1, Math.round(rawMax)));
        } else if (item.intensityType === 'heart_rate') {
          // Explicit HR zone: ALWAYS start at Zone 1 (zoneMin: 1)
          if (typeof item.zoneMin === 'number' || typeof item.zoneMax === 'number') {
            const rawMax =
              typeof item.zoneMax === 'number'
                ? item.zoneMax
                : typeof item.zoneMin === 'number'
                ? item.zoneMin
                : 2;
            item.zoneMin = 1;
            item.zoneMax = Math.min(5, Math.max(1, Math.round(rawMax)));
          }
        } else if (item.intensityType === 'none') {
          // none
        } else {
          // Qualitative intensity: map via user's Default Intensity Settings
          const resolved = resolveQualitativeServer(item.intensityType, mapping);
          if (resolved) {
            item.intensityType = resolved.intensityType;
            item.zoneMin = resolved.zoneMin;
            item.zoneMax = resolved.zoneMax;
          }
        }
      }

      // Format phase name with target and limits
      item.name = formatPhaseName(item, isInsideRepeat, originalText);
    }
  });
}

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API: Generate workout from plain text
app.post('/api/generate-workout', async (req, res) => {
  try {
    const { text, workoutName, date, defaultIntensity } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text description is required' });
    }

    const defaultMapping: DefaultIntensityServer = {
      easy: { intensityType: 'heart_rate', zoneMax: 2 },
      recovery: { intensityType: 'heart_rate', zoneMax: 2 },
      tempo: { intensityType: 'speed', zoneMax: 3 },
      threshold: { intensityType: 'heart_rate', zoneMax: 4 },
      intervals: { intensityType: 'speed', zoneMax: 5 },
      ...(defaultIntensity || {}),
    };

    const prompt = `Convert the following workout description into Polar Phased Target JSON.
Input Workout Description:
"""
${text.trim()}
"""

User supplied metadata:
Workout Name: ${workoutName ? workoutName.trim() : 'Auto-generate a fitting title'}
Target Date: ${date || new Date().toISOString().split('T')[0]}

User's Default Intensity Settings (Polar cumulative zones starting at Zone 1):
- Easy: ${formatZoneChoiceForPrompt(defaultMapping.easy, 'HR Z1–Z2')}
- Recovery: ${formatZoneChoiceForPrompt(defaultMapping.recovery, 'HR Z1–Z2')}
- Tempo: ${formatZoneChoiceForPrompt(defaultMapping.tempo, 'Pace Z1–Z3')}
- Threshold: ${formatZoneChoiceForPrompt(defaultMapping.threshold, 'HR Z1–Z4')}
- Intervals: ${formatZoneChoiceForPrompt(defaultMapping.intervals, 'Pace Z1–Z5')}

Remember:
- PRIORITY RULES:
  1. Explicit Polar zone (always starts at Zone 1). Explicit Polar zone always wins!
  2. Explicit workout structure/repeat (e.g. "Repeat the following 5x" with separators).
  3. Explicit pace (retain paceMin/paceMax in metadata AND in phase name e.g. "400m @ 5:15/km").
  4. Work-phase classification: Interval/repetition work segments inside repeat blocks must have Polar target Pace Z1-Z4 (intensityType: "speed", zoneMin: 1, zoneMax: 4).
  5. Qualitative intensity mapping: Conversational / easy -> Easy mapping. Walking rest / recovery -> Recovery mapping.
  6. No intensity target ("none", "free pace") -> intensityType: "none".
- All zoneMin values MUST be 1. The generator must NEVER generate zoneMin greater than 1!
- Do not lose explicit pace information: preserve paceMin/paceMax and include pace in phase name.
- Any line AFTER a repeat block closing separator (e.g. "90s walking rest") is STRICTLY OUTSIDE the repeat block!
- Ignore header titles (use for workout name) and footer text like plan/week/race names.
- No Power fields.
- WORKOUT TITLE RULES:
  * If the workout description contains an explicit workout title (e.g. "Title: ...", "# Heading", or a clear title line) or the user supplied a workout name, preserve it and normalize/translate it to English.
  * If there is NO clear explicit title, you MUST classify the workout into EXACTLY ONE of these 4 allowed titles:
    1. "Intervals" - for workouts with repeated work/recovery blocks, repetitions, intervals, or alternating fast/slow segments (e.g. "5 x 1 km with 2 min recovery", "6 x 800m", "5 x (400m fast + 400m steady)").
    2. "Long Run" - when the description explicitly indicates a long run (e.g. "long run", "long easy run", "long progressive run", "long Sunday run"). Never infer this only from distance.
    3. "Tempo Run" - for sustained tempo, threshold, or continuous faster effort without intervals (e.g. "15 min easy + 25 min tempo + 10 min easy", "2 km warm up + 6 km threshold + 2 km cool down").
    4. "Easy Run" - for predominantly easy/conversational running not meeting the above (e.g. "8 km easy", "45 min conversational pace").
  * PRIORITY: Explicit Title > Intervals > Long Run > Tempo Run > Easy Run.
  * NEVER invent decorative workout names (e.g. "Speed Builder", "Endurance Challenge", "Power Session", "Morning Run").
  * When no explicit title exists, the "name" field MUST be EXACTLY one of: "Easy Run", "Tempo Run", "Intervals", "Long Run".
- LANGUAGE MANDATE: All output fields ("name", phase names, "warnings") MUST ALWAYS BE IN ENGLISH, regardless of the input language. If the input is in Russian, translate all phase and workout names to standard English (e.g. "Warm up", "Interval", "Recovery", "Cool down", "Tempo", "Threshold"). NEVER output Cyrillic characters.
- If duration is in minutes or seconds, convert to seconds (e.g. 90s = 90, 10 min = 600).
- If distance is in km or meters, convert to meters (e.g. 2km = 2000, 400m = 400).`;

    const outputText = await callGemini(prompt);

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(outputText);
    } catch (parseErr: any) {
      console.error('[Generate Workout] Invalid JSON returned by AI:', outputText, parseErr);
      return res.status(422).json({
        error: 'AI returned an invalid workout structure. Please try again.',
        validationDetails: [`Failed to parse JSON: ${parseErr.message}`],
      });
    }

    // Apply repeat boundary fix and cleanup
    if (parsedJson && Array.isArray(parsedJson.phases)) {
      parsedJson.phases = fixRepeatSeparators(parsedJson.phases, text);
      parsedJson.phases = parsedJson.phases.filter((p: any) => !isFooterOrSeparatorItem(p));
      normalizePhasesWithZones(parsedJson.phases, defaultMapping, text);
    }

    // Validate structure against Workout schema
    const schemaValidation = validateWorkoutSchemaServer(parsedJson);
    if (!schemaValidation.isValid) {
      console.error('[Generate Workout] Schema validation failed:', schemaValidation.details);
      return res.status(422).json({
        error: 'AI returned an invalid workout structure. Please try again.',
        validationDetails: schemaValidation.details,
      });
    }

    parsedJson.sport = 'running';
    parsedJson.startTime = '08:00';
    if (!parsedJson.date) {
      parsedJson.date = date || new Date().toISOString().split('T')[0];
    }

    // Determine workout title:
    // If the workout description contains an explicit workout title, preserve it and normalize to English.
    // If there is NO clear explicit title, automatically choose from EXACTLY ONE OF:
    // "Easy Run", "Tempo Run", "Intervals", "Long Run".
    parsedJson.name = resolveWorkoutTitle({
      userProvidedName: workoutName,
      text,
      phases: parsedJson.phases,
    });

    // Ensure all phase names inside parsedJson are English-only
    if (Array.isArray(parsedJson.phases)) {
      parsedJson.phases.forEach((item: any) => {
        if (item.type === 'repeat' && Array.isArray(item.phases)) {
          item.phases.forEach((p: any) => {
            p.name = sanitizeEnglishString(p.name, 'Phase');
          });
        } else if (item.type === 'phase') {
          item.name = sanitizeEnglishString(item.name, 'Phase');
        }
      });
    }

    res.json(parsedJson);
  } catch (error: any) {
    console.error('Error in /api/generate-workout:', error);
    const realErrorMessage = extractGeminiErrorMessage(error);
    res.status(500).json({
      error: realErrorMessage,
    });
  }
});

// Vite & Static file serving setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Polar Workout Generator server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
