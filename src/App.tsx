import React, { useState, useMemo, useEffect } from 'react';
import { Activity, AlertCircle } from 'lucide-react';
import { Workout, ValidationError, ValidationResult } from './types/workout';
import { PolarZoneSettings } from './types/zones';
import { WorkoutInput, CreateButtonState } from './components/WorkoutInput';
import { WorkoutPreview } from './components/WorkoutPreview';
import { WorkoutEditor } from './components/WorkoutEditor';
import { ValidationPanel } from './components/ValidationPanel';
import { ExamplesSection } from './components/ExamplesSection';
import { PolarZonesSettings } from './components/PolarZonesSettings';
import { generateWorkoutFromText } from './services/geminiService';
import { checkPolarExtension, createWorkoutInPolar } from './polarExtension';
import { validateWorkout } from './utils/validation';
import { getTodayDateString } from './utils/formatters';
import { loadZoneSettings, validateZoneSettings } from './utils/zoneStorage';

export default function App() {
  // Input fields state
  const [workoutText, setWorkoutText] = useState<string>('');
  const [workoutName, setWorkoutName] = useState<string>('');
  const [workoutDate, setWorkoutDate] = useState<string>(getTodayDateString());

  // Single source of truth for the current workout
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [lastPromptText, setLastPromptText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Chrome Extension states
  const [isExtensionAvailable, setIsExtensionAvailable] = useState<boolean | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createButtonState, setCreateButtonState] = useState<CreateButtonState>('READY');
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);

  // Check extension availability when the Generator loads
  useEffect(() => {
    let mounted = true;
    checkPolarExtension().then((res) => {
      if (mounted) {
        setIsExtensionAvailable(res.available);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Polar zone settings state
  const [zoneSettings, setZoneSettings] = useState<PolarZoneSettings>(loadZoneSettings);
  const [isZoneSettingsValid, setIsZoneSettingsValid] = useState<boolean>(true);

  // Compute live validation for current workout
  const liveValidation = useMemo<ValidationResult>(() => {
    if (!currentWorkout) {
      return { isValid: true, errors: [], warnings: [] };
    }
    const res = validateWorkout(currentWorkout);
    const combinedWarnings = Array.from(
      new Set([...warnings, ...res.warnings, ...(currentWorkout.warnings || [])])
    );
    return {
      isValid: res.isValid && validationErrors.length === 0,
      errors: res.errors.length > 0 ? res.errors : validationErrors,
      warnings: combinedWarnings,
    };
  }, [currentWorkout, validationErrors, warnings]);

  // Create an error lookup by item ID or path
  const errorMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!liveValidation) return map;
    liveValidation.errors.forEach((err) => {
      map[err.id] = err.message;
      map[err.path] = err.message;
    });
    return map;
  }, [liveValidation]);

  // Valid workout available for export
  const hasValidWorkout = Boolean(currentWorkout && liveValidation.isValid);

  // Generate workout from current inputs - replaces previous workout
  const handleGenerate = async () => {
    if (!workoutText.trim()) return;

    // Check if zone settings are valid before proceeding
    if (!isZoneSettingsValid) {
      setApiError(
        'Cannot generate workout: Polar zone settings contain validation errors. Please check and correct them in the Polar Zones section.'
      );
      return;
    }

    // 1. Clear current workout state immediately before starting generation
    setCurrentWorkout(null);
    setValidationErrors([]);
    setWarnings([]);
    setCreateButtonState('READY');
    setCreateErrorMessage(null);
    setIsEditing(false);
    setSelectedPhaseId(null);
    setApiError(null);
    setIsLoading(true);

    try {
      setLastPromptText(workoutText);
      const generated = await generateWorkoutFromText(
        workoutText,
        workoutName,
        workoutDate,
        zoneSettings.defaultIntensity
      );

      // Validate workout before setting state
      const valResult = validateWorkout(generated);
      if (!valResult.isValid) {
        const details = valResult.errors.map((e) => e.message).join('; ');
        throw new Error(`AI returned an invalid workout structure. Please try again.\nDetails: ${details}`);
      }

      setValidationErrors(valResult.errors);
      setWarnings(valResult.warnings || []);
      setCurrentWorkout(generated);
      setCreateButtonState('READY');
    } catch (err: any) {
      console.error('Generation error:', err);
      setCurrentWorkout(null);
      setValidationErrors([]);
      setWarnings([]);
      setCreateButtonState('READY');
      setApiError(err.message || 'Failed to generate workout. Please check your prompt and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Create in Polar Flow action
  const handleCreateInPolarFlow = async () => {
    if (isCreating || isLoading || !currentWorkout) return;

    setCreateErrorMessage(null);

    // 1. Validate zone settings
    const currentZoneSettings = loadZoneSettings();
    const zoneValidation = validateZoneSettings(currentZoneSettings);
    if (!zoneValidation.isValid) {
      setCreateButtonState('ERROR_OTHER');
      setCreateErrorMessage(
        `Polar zone settings contain errors (${zoneValidation.error}). Check Polar Zones below.`
      );
      return;
    }

    // 2. Validate current workout
    const validation = validateWorkout(currentWorkout);
    if (!validation.isValid) {
      const firstError = validation.errors[0]?.message || 'Workout contains validation errors.';
      setCreateButtonState('ERROR_OTHER');
      setCreateErrorMessage(`Cannot export invalid workout: ${firstError}`);
      return;
    }

    // 3. Check extension availability
    setIsCreating(true);
    setCreateButtonState('WORKING');

    const check = await checkPolarExtension();
    if (!check.available) {
      setIsCreating(false);
      setCreateButtonState('ERROR_EXTENSION_MISSING');
      setIsExtensionAvailable(false);
      return;
    }
    setIsExtensionAvailable(true);

    // 4. Send workout to extension
    try {
      const result = await createWorkoutInPolar(currentWorkout);
      setIsCreating(false);

      if (result.success === true) {
        setCreateButtonState('SUCCESS');
        // Return to READY after short display (4 seconds)
        setTimeout(() => {
          setCreateButtonState('READY');
        }, 4000);
      } else {
        if (result.status === 'EXTENSION_MISSING') {
          setCreateButtonState('ERROR_EXTENSION_MISSING');
          setIsExtensionAvailable(false);
        } else if (result.status === 'LOGIN_REQUIRED') {
          setCreateButtonState('ERROR_POLAR_LOGIN');
          setCreateErrorMessage('Please log in to Polar Flow');
        } else {
          setCreateButtonState('ERROR_OTHER');
          setCreateErrorMessage(result.error || 'Could not create workout');
        }
      }
    } catch (err: any) {
      console.error('Error during Polar workout creation:', err);
      setIsCreating(false);
      setCreateButtonState('ERROR_OTHER');
      setCreateErrorMessage(err?.message || 'Could not create workout');
    }
  };

  // Reset editor changes back to original prompt generation
  const handleResetEditor = async () => {
    if (!lastPromptText.trim()) return;
    setWorkoutText(lastPromptText);
    await handleGenerate();
  };

  // Select example
  const handleSelectExample = (exampleText: string, suggestedName: string) => {
    setWorkoutText(exampleText);
    setWorkoutName(suggestedName);
    const inputEl = document.getElementById('workout-input-card');
    if (inputEl) {
      inputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans antialiased">
      {/* Top Navigation Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white shadow-2xs">
              <Activity className="w-4 h-4 text-red-500" />
            </div>
            <h1 className="text-base font-bold tracking-tight text-neutral-900">
              Polar Workout Generator
            </h1>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {/* Global API Error Alert */}
        {apiError && (
          <div
            id="api-error-alert"
            className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm shadow-2xs"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-rose-950">Generation Notice</h4>
              <p className="text-xs text-rose-800 mt-1 whitespace-pre-line leading-relaxed">
                {apiError}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setApiError(null)}
              className="text-xs text-rose-700 hover:text-rose-900 underline font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Workout Description, Metadata, & Action Row ([ Generate Workout ] [ Create in Polar Flow ]) */}
        <WorkoutInput
          text={workoutText}
          onTextChange={setWorkoutText}
          workoutName={workoutName}
          onWorkoutNameChange={setWorkoutName}
          date={workoutDate}
          onDateChange={setWorkoutDate}
          onGenerate={handleGenerate}
          isLoading={isLoading}
          onCreateInPolar={handleCreateInPolarFlow}
          isCreating={isCreating}
          createButtonState={createButtonState}
          createErrorMessage={createErrorMessage}
          hasValidWorkout={hasValidWorkout}
          isExtensionAvailable={isExtensionAvailable}
        />

        {/* 2. Workout Preview / Editor (Shows Workout name, compact phases, and [ Edit ]) */}
        {currentWorkout && (
          <div id="workout-result-section" className="space-y-4">
            {(isEditing || !liveValidation.isValid || liveValidation.warnings.length > 0) && (
              <ValidationPanel
                validation={liveValidation}
                onJumpToError={(id) => {
                  setSelectedPhaseId(id);
                  const el = document.getElementById(id);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
              />
            )}

            {isEditing ? (
              <WorkoutEditor
                workout={currentWorkout}
                onChange={(updated) => {
                  setCurrentWorkout(updated);
                  setCreateButtonState('READY');
                  setCreateErrorMessage(null);
                }}
                onDone={() => setIsEditing(false)}
                onReset={handleResetEditor}
                errorMap={errorMap}
              />
            ) : (
              <WorkoutPreview
                workout={currentWorkout}
                onEdit={() => setIsEditing(true)}
                errorMap={errorMap}
              />
            )}
          </div>
        )}

        {/* 3. Examples */}
        <ExamplesSection
          onSelectExample={handleSelectExample}
          disabled={isLoading || isCreating}
        />

        {/* 4. Polar Zones (at the very bottom, collapsed by default with compact row) */}
        <PolarZonesSettings
          onSettingsChange={(newSettings, isValid) => {
            setZoneSettings(newSettings);
            setIsZoneSettingsValid(isValid);
          }}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Polar Phased Target Generator • Text to Structured Running Workout</span>
          <span className="text-neutral-400 font-mono text-[11px]">JSON Ready for Polar Flow Automation</span>
        </div>
      </footer>
    </div>
  );
}
