import { Workout } from './types/workout';
import { createPolarExport } from './utils/polarExport';

// Declare chrome for TypeScript when @types/chrome is not installed
declare const chrome: any;

/**
 * Stable extension ID for Polar Workout Importer Chrome Extension.
 * This is the single source of truth for the Extension ID.
 */
export const POLAR_EXTENSION_ID = 'bfaciogjibpdpphhpcjhgilfhhgoholo';

export interface ExtensionCheckResult {
  available: boolean;
  status?: string;
  error?: string;
}

export interface PolarCreateResult {
  success: boolean;
  status?: 'SUCCESS' | 'EXTENSION_MISSING' | 'LOGIN_REQUIRED' | 'TIMEOUT' | 'ERROR' | string;
  error?: string;
  details?: any;
}

/**
 * Checks if the Polar Workout Importer extension is installed and responsive.
 * Returns { available: false } if chrome.runtime is unavailable or if ping fails.
 * Never throws or crashes the application.
 */
export async function checkPolarExtension(): Promise<ExtensionCheckResult> {
  if (
    typeof window === 'undefined' ||
    typeof chrome === 'undefined' ||
    !chrome?.runtime?.sendMessage
  ) {
    return { available: false };
  }

  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ available: false, error: 'Ping timed out' });
      }
    }, 3000);

    try {
      chrome.runtime.sendMessage(
        POLAR_EXTENSION_ID,
        {
          type: 'PING_POLAR_EXTENSION',
        },
        (response: any) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);

          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            resolve({ available: false, error: lastError.message || 'Extension unavailable' });
            return;
          }

          if (response && (response.success === true || response.status === 'READY')) {
            resolve({ available: true, status: response.status || 'READY' });
          } else {
            resolve({ available: false });
          }
        }
      );
    } catch (err: any) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ available: false, error: err?.message || 'Extension unavailable' });
      }
    }
  });
}

/**
 * Sends a workout directly to the Polar Workout Importer Chrome Extension.
 * Uses a 120-second timeout to allow complete Polar Flow browser automation.
 * Never uses clipboard, never triggers file download, never opens extension popup.
 */
export async function createWorkoutInPolar(workout: Workout): Promise<PolarCreateResult> {
  if (
    typeof window === 'undefined' ||
    typeof chrome === 'undefined' ||
    !chrome?.runtime?.sendMessage
  ) {
    return {
      success: false,
      status: 'EXTENSION_MISSING',
      error: 'Polar extension not installed',
    };
  }

  // Send the SAME workout object currently exported to the Chrome Extension
  const payload = createPolarExport(workout);
  const workoutToSend = payload.workout;

  return new Promise((resolve) => {
    let resolved = false;

    // Allow up to 120 seconds for complex workouts with many phases
    const TIMEOUT_MS = 120000;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          success: false,
          status: 'TIMEOUT',
          error: 'Workout creation timed out after 120 seconds. Please check Polar Flow.',
        });
      }
    }, TIMEOUT_MS);

    try {
      chrome.runtime.sendMessage(
        POLAR_EXTENSION_ID,
        {
          type: 'CREATE_POLAR_WORKOUT',
          workout: workoutToSend,
        },
        (response: any) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);

          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            resolve({
              success: false,
              status: 'EXTENSION_MISSING',
              error: 'Polar extension not installed',
            });
            return;
          }

          if (!response) {
            resolve({
              success: false,
              status: 'ERROR',
              error: 'No response received from Polar extension',
            });
            return;
          }

          if (response.success === true) {
            resolve({
              success: true,
              status: response.status || 'SUCCESS',
              details: response.details,
            });
            return;
          }

          // Error handling from extension response
          const rawError = response.error || response.message || '';
          const rawStatus = response.status || '';
          const isLoginError =
            rawStatus === 'LOGIN_REQUIRED' ||
            rawStatus === 'NOT_LOGGED_IN' ||
            /login|not logged in|session|unauthorized|sign in/i.test(`${rawError} ${rawStatus}`);

          if (isLoginError) {
            resolve({
              success: false,
              status: 'LOGIN_REQUIRED',
              error: 'Please log in to Polar Flow',
            });
          } else if (rawError && typeof rawError === 'string' && rawError.trim()) {
            resolve({
              success: false,
              status: rawStatus || 'ERROR',
              error: rawError.trim(),
            });
          } else {
            resolve({
              success: false,
              status: 'ERROR',
              error: 'Could not create workout',
            });
          }
        }
      );
    } catch (err: any) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({
          success: false,
          status: 'ERROR',
          error: err?.message || 'Could not create workout',
        });
      }
    }
  });
}
