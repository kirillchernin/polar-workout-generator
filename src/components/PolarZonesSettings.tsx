import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, RotateCcw } from 'lucide-react';
import {
  PolarZoneSettings,
  ZONE_DROPDOWN_OPTIONS,
  DEFAULT_ZONE_SETTINGS,
} from '../types/zones';
import {
  loadZoneSettings,
  saveZoneSettings,
  validateZoneSettings,
} from '../utils/zoneStorage';

interface PolarZonesSettingsProps {
  onSettingsChange?: (settings: PolarZoneSettings, isValid: boolean) => void;
}

export const PolarZonesSettings: React.FC<PolarZonesSettingsProps> = ({
  onSettingsChange,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [settings, setSettings] = useState<PolarZoneSettings>(loadZoneSettings);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validate and notify on change
  useEffect(() => {
    const val = validateZoneSettings(settings);
    setValidationError(val.error);
    if (val.isValid) {
      saveZoneSettings(settings);
    }
    if (onSettingsChange) {
      onSettingsChange(settings, val.isValid);
    }
  }, [settings, onSettingsChange]);

  const handleHrChange = (zoneIndex: number, field: 'min' | 'max', value: string) => {
    const num = parseInt(value, 10);
    const updatedHr = [...settings.hrZones];
    updatedHr[zoneIndex] = {
      ...updatedHr[zoneIndex],
      [field]: isNaN(num) ? 0 : num,
    };
    setSettings((prev) => ({
      ...prev,
      hrZones: updatedHr,
    }));
  };

  const handlePaceChange = (zoneIndex: number, field: 'faster' | 'slower', value: string) => {
    const updatedPace = [...settings.paceZones];
    updatedPace[zoneIndex] = {
      ...updatedPace[zoneIndex],
      [field]: value,
    };
    setSettings((prev) => ({
      ...prev,
      paceZones: updatedPace,
    }));
  };

  const handleMappingChange = (
    category: keyof PolarZoneSettings['defaultIntensity'],
    valueStr: string
  ) => {
    const [type, maxStr] = valueStr.split(':');
    const intensityType: 'heart_rate' | 'speed' = type === 'speed' ? 'speed' : 'heart_rate';
    const zoneMax = (parseInt(maxStr, 10) || 1) as 1 | 2 | 3 | 4 | 5;
    setSettings((prev) => ({
      ...prev,
      defaultIntensity: {
        ...prev.defaultIntensity,
        [category]: { intensityType, zoneMax },
      },
    }));
  };

  const handleResetDefaults = () => {
    setSettings(DEFAULT_ZONE_SETTINGS);
    saveZoneSettings(DEFAULT_ZONE_SETTINGS);
  };

  return (
    <div id="polar-zones-section" className="border border-neutral-200 bg-white rounded-xl overflow-hidden shadow-2xs">
      {/* Header / Compact Accordion Toggle */}
      <button
        type="button"
        id="toggle-polar-zones-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-white hover:bg-neutral-50 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-800 tracking-tight">
            Polar Zones
          </span>
          {validationError && (
            <span className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Settings have errors
            </span>
          )}
        </div>
        <span className="text-neutral-400 font-bold text-sm select-none">
          {isOpen ? '∨' : '>'}
        </span>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-4 sm:p-5 space-y-6 border-t border-neutral-200">
          {/* Validation Notice if any */}
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Tables Grid: Heart Rate & Pace */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* HEART RATE TABLE */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Heart Rate (bpm)
                </h4>
              </div>
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-100 text-neutral-600 font-semibold border-b border-neutral-200">
                    <tr>
                      <th className="py-2 px-3 w-16">Zone</th>
                      <th className="py-2 px-3">Min</th>
                      <th className="py-2 px-3">Max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {settings.hrZones.map((z, idx) => (
                      <tr key={z.zone} className="hover:bg-neutral-50/50">
                        <td className="py-2 px-3 font-semibold text-neutral-700">Z{z.zone}</td>
                        <td className="py-1.5 px-3">
                          <input
                            type="number"
                            id={`hr-z${z.zone}-min`}
                            value={z.min || ''}
                            onChange={(e) => handleHrChange(idx, 'min', e.target.value)}
                            min={1}
                            max={250}
                            className="w-full max-w-[80px] px-2 py-1 text-xs border border-neutral-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="number"
                            id={`hr-z${z.zone}-max`}
                            value={z.max || ''}
                            onChange={(e) => handleHrChange(idx, 'max', e.target.value)}
                            min={1}
                            max={250}
                            className="w-full max-w-[80px] px-2 py-1 text-xs border border-neutral-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PACE TABLE */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Pace (/km)
                </h4>
              </div>
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-100 text-neutral-600 font-semibold border-b border-neutral-200">
                    <tr>
                      <th className="py-2 px-3 w-16">Zone</th>
                      <th className="py-2 px-3">Faster</th>
                      <th className="py-2 px-3">Slower</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {settings.paceZones.map((z, idx) => (
                      <tr key={z.zone} className="hover:bg-neutral-50/50">
                        <td className="py-2 px-3 font-semibold text-neutral-700">Z{z.zone}</td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            id={`pace-z${z.zone}-faster`}
                            value={z.faster}
                            onChange={(e) => handlePaceChange(idx, 'faster', e.target.value)}
                            placeholder={z.zone === 5 ? '—' : 'M:SS'}
                            className="w-full max-w-[90px] px-2 py-1 text-xs font-mono border border-neutral-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            id={`pace-z${z.zone}-slower`}
                            value={z.slower}
                            onChange={(e) => handlePaceChange(idx, 'slower', e.target.value)}
                            placeholder="M:SS"
                            className="w-full max-w-[90px] px-2 py-1 text-xs font-mono border border-neutral-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* DEFAULT INTENSITY SECTION */}
          <div className="pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Default intensity
              </h4>
              <button
                type="button"
                id="reset-zones-btn"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset defaults
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {/* Easy */}
              <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                <label
                  htmlFor="mapping-easy"
                  className="block text-xs font-semibold text-neutral-800 mb-1"
                >
                  Easy
                </label>
                <select
                  id="mapping-easy"
                  value={`${settings.defaultIntensity.easy.intensityType}:${settings.defaultIntensity.easy.zoneMax}`}
                  onChange={(e) => handleMappingChange('easy', e.target.value)}
                  className="w-full text-xs font-medium py-1 px-1.5 bg-white border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                >
                  {ZONE_DROPDOWN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recovery */}
              <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                <label
                  htmlFor="mapping-recovery"
                  className="block text-xs font-semibold text-neutral-800 mb-1"
                >
                  Recovery
                </label>
                <select
                  id="mapping-recovery"
                  value={`${settings.defaultIntensity.recovery.intensityType}:${settings.defaultIntensity.recovery.zoneMax}`}
                  onChange={(e) => handleMappingChange('recovery', e.target.value)}
                  className="w-full text-xs font-medium py-1 px-1.5 bg-white border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                >
                  {ZONE_DROPDOWN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tempo */}
              <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                <label
                  htmlFor="mapping-tempo"
                  className="block text-xs font-semibold text-neutral-800 mb-1"
                >
                  Tempo
                </label>
                <select
                  id="mapping-tempo"
                  value={`${settings.defaultIntensity.tempo.intensityType}:${settings.defaultIntensity.tempo.zoneMax}`}
                  onChange={(e) => handleMappingChange('tempo', e.target.value)}
                  className="w-full text-xs font-medium py-1 px-1.5 bg-white border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                >
                  {ZONE_DROPDOWN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Threshold */}
              <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                <label
                  htmlFor="mapping-threshold"
                  className="block text-xs font-semibold text-neutral-800 mb-1"
                >
                  Threshold
                </label>
                <select
                  id="mapping-threshold"
                  value={`${settings.defaultIntensity.threshold.intensityType}:${settings.defaultIntensity.threshold.zoneMax}`}
                  onChange={(e) => handleMappingChange('threshold', e.target.value)}
                  className="w-full text-xs font-medium py-1 px-1.5 bg-white border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                >
                  {ZONE_DROPDOWN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Intervals */}
              <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 col-span-2 sm:col-span-1">
                <label
                  htmlFor="mapping-intervals"
                  className="block text-xs font-semibold text-neutral-800 mb-1"
                >
                  Intervals
                </label>
                <select
                  id="mapping-intervals"
                  value={`${settings.defaultIntensity.intervals.intensityType}:${settings.defaultIntensity.intervals.zoneMax}`}
                  onChange={(e) => handleMappingChange('intervals', e.target.value)}
                  className="w-full text-xs font-medium py-1 px-1.5 bg-white border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                >
                  {ZONE_DROPDOWN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
