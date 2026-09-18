/**
 * Automatic Workout Title Classification & Normalization
 *
 * Rules:
 * - If the workout description contains an explicit workout title, preserve it
 *   and normalize it to English if necessary.
 * - If there is NO clear explicit title, automatically choose the workout name
 *   from the workout structure and content.
 *
 * Default titles (ONLY these 4 allowed when no explicit title exists):
 * - Easy Run
 * - Tempo Run
 * - Intervals
 * - Long Run
 *
 * PRIORITY:
 * Explicit Title > Intervals > Long Run > Tempo Run > Easy Run
 */

export type DefaultWorkoutTitle = 'Easy Run' | 'Tempo Run' | 'Intervals' | 'Long Run';

export const DEFAULT_WORKOUT_TITLES: readonly DefaultWorkoutTitle[] = [
  'Intervals',
  'Long Run',
  'Tempo Run',
  'Easy Run',
] as const;

/**
 * Normalizes any string to English, stripping Cyrillic and translating common running terms.
 */
export function sanitizeEnglishTitle(text: string, fallback: string = 'Running Workout'): string {
  if (!text) return fallback;
  let s = text.trim();

  // Strip leading prefixes like "Title:", "Workout:", "#"
  s = s.replace(/^(?:title|workout\s*name|workout|name|название|тренировка)\s*:\s*/i, '');
  s = s.replace(/^#{1,3}\s+/, '');

  // Common running terms translation (Russian -> English)
  s = s.replace(/интервалы\s*на\s*стадионе/gi, 'Track Intervals');
  s = s.replace(/интервалы/gi, 'Intervals');
  s = s.replace(/разминка/gi, 'Warm up');
  s = s.replace(/заминка/gi, 'Cool down');
  s = s.replace(/восстановление|отдых/gi, 'Recovery');
  s = s.replace(/темповый\s*бег|темп/gi, 'Tempo Run');
  s = s.replace(/порог\w*|пано/gi, 'Threshold');
  s = s.replace(/длительный\s*бег|длительная/gi, 'Long Run');
  s = s.replace(/восстановительный\s*бег/gi, 'Recovery Run');
  s = s.replace(/легкий\s*бег|легко/gi, 'Easy Run');
  s = s.replace(/горки|бег\s*в\s*гору/gi, 'Hill Repeats');
  s = s.replace(/фартлек/gi, 'Fartlek');
  s = s.replace(/стадион/gi, 'Track');
  s = s.replace(/ходьба|шагом/gi, 'Walk');
  s = s.replace(/бег\w*/gi, 'Run');
  s = s.replace(/км/gi, 'km');
  s = s.replace(/м(?![a-zа-я])/gi, 'm');
  s = s.replace(/мин\w*/gi, 'min');
  s = s.replace(/сек\w*/gi, 's');
  s = s.replace(/х/g, 'x');

  // Strip remaining Cyrillic letters
  s = s.replace(/[а-яА-ЯёЁ]/g, '');
  s = s.replace(/\s+/g, ' ').trim();

  // Remove surrounding quotes or punctuation
  s = s.replace(/^["'`«]+|["'`»]+$/g, '').trim();

  return s || fallback;
}

/**
 * Checks if a title is a generic non-descriptive placeholder.
 */
export function isGenericTitle(title: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  return (
    t === 'workout' ||
    t === 'running workout' ||
    t === 'running' ||
    t === 'run' ||
    t === 'training' ||
    t === 'session' ||
    t === 'my workout' ||
    t === 'untitled' ||
    t === 'new workout' ||
    t === 'phase' ||
    t === 'тренировка' ||
    t === 'бег'
  );
}

/**
 * Extracts a clear explicit title from workout text if one is present.
 * Looks for:
 * 1. "Title: <name>" or "Workout: <name>" or "Name: <name>"
 * 2. Markdown heading: "# <name>" or "## <name>"
 * 3. Multi-line description where line 1 is a standalone title (<= 50 chars, no duration/distance units or phase verbs)
 */
export function extractExplicitTitle(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Explicit label prefix on any of the initial lines
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  for (const line of lines.slice(0, 2)) {
    const labelMatch = line.match(/^(?:title|workout\s*name|workout|name|название|тренировка)\s*:\s*(.+)$/i);
    if (labelMatch) {
      const raw = labelMatch[1].trim();
      if (raw && !isGenericTitle(raw)) {
        return sanitizeEnglishTitle(raw, 'Running Workout');
      }
    }

    // Markdown heading
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      const raw = headingMatch[1].trim();
      if (raw && !isGenericTitle(raw)) {
        return sanitizeEnglishTitle(raw, 'Running Workout');
      }
    }
  }

  // 2. Standalone title on the very first line of a multi-line workout
  if (lines.length >= 2) {
    const firstLine = lines[0];

    // Must not be a separator line
    if (/^[-_=*~]{3,}$/.test(firstLine)) return null;

    // Must not start with list bullets or step numbers
    if (/^(\d+\.|\-|\*)\s+/.test(firstLine)) return null;

    // Must not be or start with workout phase indicators
    if (/^(repeat|warm\s*up|cool\s*down|разминка|заминка|повтор|recovery|rest|отдых)/i.test(firstLine)) return null;

    // Must not contain numbers with duration/distance units
    if (/\b\d+\s*(km|m|км|м|min|sec|мин|сек|s)\b/i.test(firstLine)) return null;

    // Must not contain repetition indicators like "5 x 1k", "6x800", "5 х 1"
    if (/\b\d+\s*[xх]\s*/i.test(firstLine)) return null;

    // Must not contain pace notation
    if (/\b\d+:\d\d(?:\/km)?/i.test(firstLine)) return null;

    // Must not contain connector words like "+", "then", "with"
    if (/(\+|,?\s*then\b|followed by|with\s+\d)/i.test(firstLine)) return null;

    // If first line has words like "easy", "tempo", "threshold", but combined with workout instructions:
    const hasRunningKeywords = /\b(easy|tempo|threshold|fast|steady|pace|recovery|walk|warm|cool|бег|трусц\w*)\b/i.test(firstLine);
    if (hasRunningKeywords && firstLine.length > 25) return null;

    // If reasonably short (<= 50 characters) and not generic
    if (firstLine.length <= 50 && !isGenericTitle(firstLine)) {
      // Check that remaining lines actually describe the workout steps
      const remainingText = lines.slice(1).join(' ');
      const hasWorkoutSteps =
        /\b\d+\s*(km|m|min|sec|s|км|м|мин|сек)\b/i.test(remainingText) ||
        /\b(easy|warm|cool|tempo|threshold|recovery|rest|walk)\b/i.test(remainingText);

      if (hasWorkoutSteps) {
        return sanitizeEnglishTitle(firstLine, 'Running Workout');
      }
    }
  }

  return null;
}

/**
 * 1. INTERVALS CLASSIFICATION
 * Use "Intervals" if the workout contains repeated work/recovery blocks,
 * repetitions, intervals or clearly alternating faster/slower sections.
 */
export function isIntervalsWorkout(text: string, phases?: any[]): boolean {
  // A. Check structured phases for repeat blocks
  if (Array.isArray(phases)) {
    for (const item of phases) {
      if (item && typeof item === 'object' && item.type === 'repeat') {
        const reps = Math.max(1, item.repetitions || 1);
        const childCount = item.phases?.length || 0;
        if (reps >= 2 || childCount >= 2) return true;
      }
    }
  }

  // B. Check text for repetitions notation
  // e.g. "5 x 1 km", "6 x 800m", "5 x (400m fast + 400m steady)", "4x5 min", "10x400"
  if (/(?:^|[^\p{L}\p{N}])\d+\s*[xх]\s*(\(|\[|\d)/iu.test(text)) return true;
  if (/(?:^|[^\p{L}\p{N}])\d+\s*times(?:$|[^\p{L}\p{N}])/iu.test(text)) return true;
  if (/(?:^|[^\p{L}\p{N}])\d+\s*(повтор\p{L}*|раз)(?:$|[^\p{L}\p{N}])/iu.test(text)) return true;

  // C. Check text for intervals terminology
  if (/(?:^|[^\p{L}\p{N}])(interval|intervals|интервал\p{L}*|repetitions|repeats|reps|fartlek|фартлек|hill repeats|hill sprints)(?:$|[^\p{L}\p{N}])/iu.test(text)) {
    return true;
  }

  // D. Check for alternating faster / slower sections in flat phases
  if (Array.isArray(phases) && phases.length >= 4) {
    let alternatingCount = 0;
    for (let i = 0; i < phases.length - 1; i++) {
      const curr = phases[i];
      const next = phases[i + 1];
      if (curr && next) {
        const currName = (curr.name || '').toLowerCase();
        const nextName = (next.name || '').toLowerCase();
        const currIsWork =
          curr.intensity === 'tempo' ||
          curr.intensity === 'threshold' ||
          curr.intensityType === 'speed' ||
          currName.includes('work') ||
          currName.includes('fast') ||
          currName.includes('interval');
        const nextIsRecovery =
          next.intensity === 'recovery' ||
          next.intensity === 'easy' ||
          nextName.includes('recovery') ||
          nextName.includes('rest') ||
          nextName.includes('walk') ||
          nextName.includes('easy');

        if (currIsWork && nextIsRecovery) {
          alternatingCount++;
        }
      }
    }
    if (alternatingCount >= 2) return true;
  }

  return false;
}

/**
 * 2. LONG RUN CLASSIFICATION
 * Use "Long Run" when the description explicitly indicates:
 * - long run
 * - long easy run
 * - long progressive run
 * - long Sunday run
 * or otherwise clearly identifies the session as a long run.
 * Do NOT infer "Long Run" only because the distance happens to be large.
 * Prefer explicit long-run meaning from the workout description.
 */
export function isLongRunWorkout(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const longRunRegex =
    /(?:^|[^\p{L}\p{N}])(long\s+run|long\s+easy\s+run|long\s+progressive\s+run|long\s+sunday\s+run|sunday\s+long\s+run|weekly\s+long\s+run|long\s+aerobic\s+run|long\s+steady\s+run|long\s+continuous\s+run|длительн\p{L}*(?:\s+бег)?)(?:$|[^\p{L}\p{N}])/iu;

  return longRunRegex.test(text);
}

/**
 * 3. TEMPO RUN CLASSIFICATION
 * Use "Tempo Run" when the main workout contains a sustained tempo,
 * threshold or other continuous faster effort without interval/recovery
 * structure.
 * Examples:
 * 15 min easy + 25 min tempo + 10 min easy → Tempo Run
 * 2 km warm up + 6 km threshold + 2 km cool down → Tempo Run
 */
export function isTempoRunWorkout(text: string, phases?: any[]): boolean {
  if (!text || typeof text !== 'string') return false;

  const tempoKeywords =
    /(?:^|[^\p{L}\p{N}])(tempo|темп\p{L}*|threshold|порог\p{L}*|пано|marathon\s*pace|марафонск\p{L}*|steady\s*state|lactate\s*threshold)(?:$|[^\p{L}\p{N}])/iu;

  if (tempoKeywords.test(text)) return true;

  if (Array.isArray(phases)) {
    for (const p of phases) {
      if (p && typeof p === 'object' && p.type === 'phase') {
        const name = (p.name || '').toLowerCase();
        if (tempoKeywords.test(name)) return true;
        if (p.intensity === 'tempo' || p.intensity === 'threshold' || p.intensity === 'marathon_pace') return true;
        if (p.intensityType === 'speed' && (p.zoneMax === 3 || p.zoneMax === 4)) return true;
      }
    }
  }

  return false;
}

/**
 * Automatically classifies a workout into EXACTLY ONE of the four allowed default titles:
 * - Intervals
 * - Long Run
 * - Tempo Run
 * - Easy Run
 *
 * PRIORITY ORDER:
 * Intervals > Long Run > Tempo Run > Easy Run
 */
export function classifyWorkoutTitle(text: string, phases: any[] = []): DefaultWorkoutTitle {
  // 1. INTERVALS (highest priority)
  if (isIntervalsWorkout(text, phases)) {
    return 'Intervals';
  }

  // 2. LONG RUN (second priority)
  if (isLongRunWorkout(text)) {
    return 'Long Run';
  }

  // 3. TEMPO RUN (third priority)
  if (isTempoRunWorkout(text, phases)) {
    return 'Tempo Run';
  }

  // 4. EASY RUN (default / fallback)
  return 'Easy Run';
}

/**
 * Master title resolver:
 * - If explicit workout title provided (user input or description text), preserve & normalize to English.
 * - If NO clear explicit title, automatically choose from the 4 default titles.
 * - Guaranteed to never output decorative names ("Speed Builder", "Endurance Challenge", etc.).
 */
export function resolveWorkoutTitle(options: {
  userProvidedName?: string | null;
  text: string;
  phases?: any[];
}): string {
  const { userProvidedName, text, phases = [] } = options;

  // 1. User explicitly provided a name in the input box
  if (userProvidedName && typeof userProvidedName === 'string') {
    const trimmed = userProvidedName.trim();
    if (trimmed && !isGenericTitle(trimmed)) {
      return sanitizeEnglishTitle(trimmed, 'Running Workout');
    }
  }

  // 2. Explicit workout title in the description text
  const explicitFromText = extractExplicitTitle(text);
  if (explicitFromText && !isGenericTitle(explicitFromText)) {
    return sanitizeEnglishTitle(explicitFromText, 'Running Workout');
  }

  // 3. No clear explicit title -> strictly classify into one of the 4 allowed default titles
  return classifyWorkoutTitle(text, phases);
}
