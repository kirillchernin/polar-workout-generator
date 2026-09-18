# Polar Flow Chrome Extension Integration Contract

This document defines the interface and execution contract between the **Polar Workout Generator** web application and the **Polar Flow Chrome Extension**.

The web application is strictly a **text-to-Polar-Phased-Target generator and editor**. The Chrome Extension is responsible for controlling the already-open Polar Flow Web interface (`https://flow.polar.com`) within the user's Chrome browser session.

---

## 1. Data Schema & Contract

### Schema Version
`schemaVersion: 1`

The Chrome Extension MUST inspect `schemaVersion` before processing. If an unsupported version is encountered, the extension must display a version mismatch notice to the user.

### Source Identifier
`source: "polar-workout-generator"`

### Envelope Structure (`PolarExport`)

```typescript
interface PolarExport {
  schemaVersion: number;
  source: "polar-workout-generator";
  workout: {
    name: string;
    sport: "running";
    date: string; // ISO format: YYYY-MM-DD
    startTime: "08:00"; // Always "08:00"
    phases: WorkoutItem[];
  };
}

type WorkoutItem = WorkoutPhase | RepeatBlock;

interface WorkoutPhase {
  type: "phase";
  name: string;
  durationType: "time" | "distance";
  duration: number; // seconds for "time", meters for "distance"
  intensityType: IntensityType;
  paceMin?: string; // M:SS, e.g. "4:50"
  paceMax?: string; // M:SS, e.g. "5:00"
  hrMin?: number;   // bpm, e.g. 140
  hrMax?: number;   // bpm, e.g. 155
  powerMin?: number; // watts, e.g. 250
  powerMax?: number; // watts, e.g. 280
}

interface RepeatBlock {
  type: "repeat";
  repetitions: number; // positive integer (e.g. 5)
  phases: WorkoutPhase[]; // sub-phases executed within each repetition
}

type IntensityType =
  | "none"
  | "easy"
  | "recovery"
  | "threshold"
  | "tempo"
  | "marathon_pace"
  | "pace"
  | "heart_rate"
  | "power";
```

---

## 2. Supported Phase and Intensity Types

| Field | Supported Values | Representation in Polar Flow |
| :--- | :--- | :--- |
| `type` | `"phase"`, `"repeat"` | Standard phase or nested repeat loop block |
| `durationType` | `"time"`, `"distance"` | Duration toggles: hours:minutes:seconds or kilometers/meters |
| `duration` | Positive integer | Time in seconds (converted to mm:ss/hh:mm:ss) or distance in meters (e.g. 1000m = 1.00 km) |
| `intensityType` | `"pace"` | Pace/speed zone target (`paceMin` to `paceMax` in min/km) |
| `intensityType` | `"easy"`, `"recovery"`, `"none"` | Free intensity / Zone 1-2 recovery or warm-up |
| `intensityType` | `"threshold"`, `"tempo"`, `"marathon_pace"` | Aerobic/threshold zones (Zone 3-4) |
| `intensityType` | `"heart_rate"` | Target HR zone or specific bpm range (`hrMin`–`hrMax`) |
| `intensityType` | `"power"` | Target running power zone or wattage range (`powerMin`–`powerMax`) |

---

## 3. Expected Extension Automation Flow

When the user activates the extension (or clicks the extension action with a copied workout):

1. **Verify Location**: Verify active tab is on `https://flow.polar.com/*`.
2. **Authentication Verification**:
   - Check if the user is authenticated in Polar Flow.
   - If redirected to `auth.polar.com/login` or signed out, notify user: *"Please sign in to Polar Flow first."*
   - **Security mandate:** The extension must **NEVER** ask for, receive, or store the user's Polar password. It operates purely within the user's authenticated web session.
3. **Navigate to Target Creation**:
   - Navigate to Diary or click the **"+" (Add)** button.
   - Select **"Training target"**.
4. **Select Phased Target**:
   - Switch creation mode to **"Phased Target"** (or create new phased target).
5. **Set Basic Information**:
   - Target name: `workout.name`
   - Sport: `workout.sport` ("running")
   - Scheduled date: `workout.date`
   - Scheduled start time: `workout.startTime` (always `"08:00"`)
6. **Construct Phases & Repeats**:
   - For each element in `workout.phases`:
     - If `type === "phase"`: Add phase, fill phase name, set duration type (time or distance), enter duration values, configure intensity target.
     - If `type === "repeat"`: Add repeat block, set repetition count (`repetitions`), and populate nested sub-phases.
7. **Save Target to Diary**:
   - Click **"Add to Diary"** / **"Save"**.
   - Verify success confirmation from Polar Flow.
8. **Feedback to User**:
   - Report that the workout was successfully scheduled on the Polar Flow Diary for the given date.

---

## 4. Error States and Handling

| Error Code / State | Trigger Condition | Extension Handling / Message |
| :--- | :--- | :--- |
| `INVALID_SCHEMA` | `schemaVersion !== 1` or missing required fields | "Unsupported workout schema version. Please update the generator or extension." |
| `NOT_ON_POLAR` | Current tab is not on `flow.polar.com` | "Please navigate to Polar Flow (flow.polar.com) to import this workout." |
| `NOT_LOGGED_IN` | Session is unauthenticated or redirected to auth | "Polar Flow login required. Please sign in to your Polar account." |
| `MODAL_NOT_FOUND` | Training target modal failed to open | "Could not open Training Target dialog in Polar Flow." |
| `PHASE_CREATION_FAILED` | DOM mismatch or field could not be filled | "Failed to configure phase: [Phase Name]." |
| `SAVE_FAILED` | Polar Flow rejected form or save button did not confirm | "Unable to save training target in Polar Flow Diary." |

---

## 5. Canonical Example JSON

```json
{
  "schemaVersion": 1,
  "source": "polar-workout-generator",
  "workout": {
    "name": "5x1K Intervals",
    "sport": "running",
    "date": "2026-09-15",
    "startTime": "08:00",
    "phases": [
      {
        "type": "phase",
        "name": "Warm up",
        "durationType": "time",
        "duration": 600,
        "intensityType": "easy"
      },
      {
        "type": "repeat",
        "repetitions": 5,
        "phases": [
          {
            "type": "phase",
            "name": "Interval",
            "durationType": "distance",
            "duration": 1000,
            "intensityType": "pace",
            "paceMin": "4:50",
            "paceMax": "5:00"
          },
          {
            "type": "phase",
            "name": "Recovery",
            "durationType": "time",
            "duration": 120,
            "intensityType": "easy"
          }
        ]
      },
      {
        "type": "phase",
        "name": "Cool down",
        "durationType": "time",
        "duration": 600,
        "intensityType": "easy"
      }
    ]
  }
}
```
