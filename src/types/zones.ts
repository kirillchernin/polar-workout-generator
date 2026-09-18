export interface HrZone {
  zone: number;
  min: number;
  max: number;
}

export interface PaceZone {
  zone: number;
  faster: string;
  slower: string;
}

export type ZoneChoice =
  | 'HR Z1'
  | 'HR Z1–Z2'
  | 'HR Z1–Z3'
  | 'HR Z1–Z4'
  | 'HR Z1–Z5'
  | 'Pace Z1'
  | 'Pace Z1–Z2'
  | 'Pace Z1–Z3'
  | 'Pace Z1–Z4'
  | 'Pace Z1–Z5';

export interface ZoneSetting {
  intensityType: 'heart_rate' | 'speed';
  zoneMax: 1 | 2 | 3 | 4 | 5;
}

export interface ZoneDropdownOption {
  value: string;
  label: ZoneChoice;
  intensityType: 'heart_rate' | 'speed';
  zoneMax: 1 | 2 | 3 | 4 | 5;
}

export const ZONE_CHOICES: ZoneChoice[] = [
  'HR Z1',
  'HR Z1–Z2',
  'HR Z1–Z3',
  'HR Z1–Z4',
  'HR Z1–Z5',
  'Pace Z1',
  'Pace Z1–Z2',
  'Pace Z1–Z3',
  'Pace Z1–Z4',
  'Pace Z1–Z5',
];

export const ZONE_DROPDOWN_OPTIONS: ZoneDropdownOption[] = [
  { value: 'heart_rate:1', label: 'HR Z1', intensityType: 'heart_rate', zoneMax: 1 },
  { value: 'heart_rate:2', label: 'HR Z1–Z2', intensityType: 'heart_rate', zoneMax: 2 },
  { value: 'heart_rate:3', label: 'HR Z1–Z3', intensityType: 'heart_rate', zoneMax: 3 },
  { value: 'heart_rate:4', label: 'HR Z1–Z4', intensityType: 'heart_rate', zoneMax: 4 },
  { value: 'heart_rate:5', label: 'HR Z1–Z5', intensityType: 'heart_rate', zoneMax: 5 },
  { value: 'speed:1', label: 'Pace Z1', intensityType: 'speed', zoneMax: 1 },
  { value: 'speed:2', label: 'Pace Z1–Z2', intensityType: 'speed', zoneMax: 2 },
  { value: 'speed:3', label: 'Pace Z1–Z3', intensityType: 'speed', zoneMax: 3 },
  { value: 'speed:4', label: 'Pace Z1–Z4', intensityType: 'speed', zoneMax: 4 },
  { value: 'speed:5', label: 'Pace Z1–Z5', intensityType: 'speed', zoneMax: 5 },
];

export function getZoneChoiceLabel(setting: ZoneSetting): ZoneChoice {
  const prefix = setting.intensityType === 'heart_rate' ? 'HR' : 'Pace';
  if (setting.zoneMax === 1) {
    return `${prefix} Z1` as ZoneChoice;
  }
  return `${prefix} Z1–Z${setting.zoneMax}` as ZoneChoice;
}

export interface DefaultIntensityMapping {
  easy: ZoneSetting;
  recovery: ZoneSetting;
  tempo: ZoneSetting;
  threshold: ZoneSetting;
  intervals: ZoneSetting;
}

export interface PolarZoneSettings {
  hrZones: HrZone[];
  paceZones: PaceZone[];
  defaultIntensity: DefaultIntensityMapping;
}

export const DEFAULT_HR_ZONES: HrZone[] = [
  { zone: 1, min: 95, max: 112 },
  { zone: 2, min: 113, max: 131 },
  { zone: 3, min: 132, max: 150 },
  { zone: 4, min: 151, max: 169 },
  { zone: 5, min: 170, max: 189 },
];

export const DEFAULT_PACE_ZONES: PaceZone[] = [
  { zone: 1, faster: '5:56', slower: '7:36' },
  { zone: 2, faster: '4:55', slower: '5:56' },
  { zone: 3, faster: '4:10', slower: '4:55' },
  { zone: 4, faster: '3:37', slower: '4:10' },
  { zone: 5, faster: '', slower: '3:37' },
];

export const DEFAULT_INTENSITY_MAPPING: DefaultIntensityMapping = {
  easy: { intensityType: 'heart_rate', zoneMax: 2 },
  recovery: { intensityType: 'heart_rate', zoneMax: 2 },
  tempo: { intensityType: 'speed', zoneMax: 3 },
  threshold: { intensityType: 'heart_rate', zoneMax: 4 },
  intervals: { intensityType: 'speed', zoneMax: 5 },
};

export const DEFAULT_ZONE_SETTINGS: PolarZoneSettings = {
  hrZones: DEFAULT_HR_ZONES,
  paceZones: DEFAULT_PACE_ZONES,
  defaultIntensity: DEFAULT_INTENSITY_MAPPING,
};
