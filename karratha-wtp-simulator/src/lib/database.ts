/**
 * INDEXEDDB DATABASE MODULE
 * ==========================
 * Local storage for simulation data using IndexedDB
 * No server required - all data stored in browser
 *
 * Features:
 * - Session management (save/load simulation states)
 * - Trend data archival
 * - Alarm history persistence
 * - Configuration presets
 * - Automatic cleanup of old data
 */

import { debug, info, warn, error } from './debug-utils';
import type {
  SimulationState,
  ProcessAlarm,
  TrendDataPoint,
  FeedProperties,
  EquipmentConfig,
} from './process-types';

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DB_NAME = 'KarrathaWTP';
const DB_VERSION = 1;

const STORES = {
  sessions: 'sessions',
  trends: 'trends',
  alarms: 'alarms',
  presets: 'presets',
  settings: 'settings',
} as const;

// Maximum records to keep
const LIMITS = {
  sessions: 50,
  trends: 10000,
  alarms: 5000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface SavedSession {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  simTime: number;
  state: Partial<SimulationState>;
  notes?: string;
}

export interface SavedPreset {
  id: string;
  name: string;
  category: 'feed' | 'equipment' | 'control' | 'full';
  createdAt: Date;
  data: Partial<FeedProperties> | Partial<EquipmentConfig> | Partial<SimulationState>;
  description?: string;
}

export interface Settings {
  autoSaveInterval: number;  // minutes (0 = disabled)
  maxTrendPoints: number;
  theme: 'dark' | 'light' | 'auto';
  units: 'metric' | 'imperial';
  debugMode: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      error('Database', 'Failed to open database', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      info('Database', 'Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      info('Database', 'Upgrading database schema...');

      // Sessions store
      if (!database.objectStoreNames.contains(STORES.sessions)) {
        const sessionsStore = database.createObjectStore(STORES.sessions, {
          keyPath: 'id',
        });
        sessionsStore.createIndex('createdAt', 'createdAt', { unique: false });
        sessionsStore.createIndex('name', 'name', { unique: false });
      }

      // Trends store (for archival)
      if (!database.objectStoreNames.contains(STORES.trends)) {
        const trendsStore = database.createObjectStore(STORES.trends, {
          keyPath: 'id',
          autoIncrement: true,
        });
        trendsStore.createIndex('sessionId', 'sessionId', { unique: false });
        trendsStore.createIndex('time', 'time', { unique: false });
      }

      // Alarms store
      if (!database.objectStoreNames.contains(STORES.alarms)) {
        const alarmsStore = database.createObjectStore(STORES.alarms, {
          keyPath: 'id',
        });
        alarmsStore.createIndex('sessionId', 'sessionId', { unique: false });
        alarmsStore.createIndex('timestamp', 'timestamp', { unique: false });
        alarmsStore.createIndex('priority', 'priority', { unique: false });
      }

      // Presets store
      if (!database.objectStoreNames.contains(STORES.presets)) {
        const presetsStore = database.createObjectStore(STORES.presets, {
          keyPath: 'id',
        });
        presetsStore.createIndex('category', 'category', { unique: false });
        presetsStore.createIndex('name', 'name', { unique: false });
      }

      // Settings store (single record)
      if (!database.objectStoreNames.contains(STORES.settings)) {
        database.createObjectStore(STORES.settings, { keyPath: 'id' });
      }

      info('Database', 'Database schema created');
    };
  });
}

/**
 * Get database connection (initializes if needed)
 */
async function getDB(): Promise<IDBDatabase> {
  if (!db) {
    await initDatabase();
  }
  return db!;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save current simulation state as a session
 */
export async function saveSession(
  name: string,
  state: Partial<SimulationState>,
  notes?: string
): Promise<SavedSession> {
  const database = await getDB();

  const session: SavedSession = {
    id: generateSessionId(),
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    simTime: state.simTime || 0,
    state,
    notes,
  };

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.sessions, 'readwrite');
    const store = tx.objectStore(STORES.sessions);

    const request = store.add(session);

    request.onsuccess = () => {
      info('Database', `Session saved: ${name}`, { id: session.id });
      resolve(session);
    };

    request.onerror = () => {
      error('Database', 'Failed to save session', request.error);
      reject(request.error);
    };
  });
}

/**
 * Update an existing session
 */
export async function updateSession(
  id: string,
  state: Partial<SimulationState>,
  notes?: string
): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.sessions, 'readwrite');
    const store = tx.objectStore(STORES.sessions);

    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const session = getRequest.result as SavedSession;
      if (!session) {
        reject(new Error(`Session not found: ${id}`));
        return;
      }

      session.updatedAt = new Date();
      session.simTime = state.simTime || session.simTime;
      session.state = state;
      if (notes !== undefined) session.notes = notes;

      const putRequest = store.put(session);
      putRequest.onsuccess = () => {
        info('Database', `Session updated: ${session.name}`);
        resolve();
      };
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Load a session by ID
 */
export async function loadSession(id: string): Promise<SavedSession | null> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.sessions, 'readonly');
    const store = tx.objectStore(STORES.sessions);
    const request = store.get(id);

    request.onsuccess = () => {
      const session = request.result as SavedSession | undefined;
      if (session) {
        info('Database', `Session loaded: ${session.name}`);
      }
      resolve(session || null);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all saved sessions
 */
export async function getAllSessions(): Promise<SavedSession[]> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.sessions, 'readonly');
    const store = tx.objectStore(STORES.sessions);
    const request = store.getAll();

    request.onsuccess = () => {
      const sessions = (request.result as SavedSession[])
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(sessions);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a session
 */
export async function deleteSession(id: string): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.sessions, 'readwrite');
    const store = tx.objectStore(STORES.sessions);
    const request = store.delete(id);

    request.onsuccess = () => {
      info('Database', `Session deleted: ${id}`);
      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREND DATA ARCHIVAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Archive trend data for a session
 */
export async function archiveTrends(
  sessionId: string,
  trends: TrendDataPoint[]
): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.trends, 'readwrite');
    const store = tx.objectStore(STORES.trends);

    let completed = 0;
    const total = trends.length;

    trends.forEach((trend) => {
      const record = { ...trend, sessionId };
      const request = store.add(record);

      request.onsuccess = () => {
        completed++;
        if (completed === total) {
          info('Database', `Archived ${total} trend points for session ${sessionId}`);
          resolve();
        }
      };

      request.onerror = () => {
        warn('Database', 'Failed to archive trend point', request.error);
      };
    });

    if (total === 0) resolve();
  });
}

/**
 * Get trends for a session
 */
export async function getSessionTrends(sessionId: string): Promise<TrendDataPoint[]> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.trends, 'readonly');
    const store = tx.objectStore(STORES.trends);
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);

    request.onsuccess = () => {
      resolve(request.result as TrendDataPoint[]);
    };

    request.onerror = () => reject(request.error);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALARM HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save alarm to history
 */
export async function saveAlarm(
  sessionId: string,
  alarm: ProcessAlarm
): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.alarms, 'readwrite');
    const store = tx.objectStore(STORES.alarms);

    const record = { ...alarm, sessionId };
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get alarm history for a session
 */
export async function getSessionAlarms(sessionId: string): Promise<ProcessAlarm[]> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.alarms, 'readonly');
    const store = tx.objectStore(STORES.alarms);
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);

    request.onsuccess = () => {
      resolve(request.result as ProcessAlarm[]);
    };

    request.onerror = () => reject(request.error);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save a preset configuration
 */
export async function savePreset(preset: Omit<SavedPreset, 'id' | 'createdAt'>): Promise<SavedPreset> {
  const database = await getDB();

  const savedPreset: SavedPreset = {
    ...preset,
    id: `preset_${Date.now()}`,
    createdAt: new Date(),
  };

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.presets, 'readwrite');
    const store = tx.objectStore(STORES.presets);
    const request = store.add(savedPreset);

    request.onsuccess = () => {
      info('Database', `Preset saved: ${preset.name}`);
      resolve(savedPreset);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all presets, optionally filtered by category
 */
export async function getPresets(category?: SavedPreset['category']): Promise<SavedPreset[]> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.presets, 'readonly');
    const store = tx.objectStore(STORES.presets);

    let request: IDBRequest;
    if (category) {
      const index = store.index('category');
      request = index.getAll(category);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      resolve(request.result as SavedPreset[]);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a preset
 */
export async function deletePreset(id: string): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.presets, 'readwrite');
    const store = tx.objectStore(STORES.presets);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS: Settings = {
  autoSaveInterval: 5,
  maxTrendPoints: 300,
  theme: 'dark',
  units: 'metric',
  debugMode: false,
};

/**
 * Get application settings
 */
export async function getSettings(): Promise<Settings> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.settings, 'readonly');
    const store = tx.objectStore(STORES.settings);
    const request = store.get('settings');

    request.onsuccess = () => {
      const settings = request.result?.data as Settings | undefined;
      resolve(settings || DEFAULT_SETTINGS);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Update application settings
 */
export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  const database = await getDB();
  const current = await getSettings();
  const updated = { ...current, ...settings };

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.settings, 'readwrite');
    const store = tx.objectStore(STORES.settings);
    const request = store.put({ id: 'settings', data: updated });

    request.onsuccess = () => {
      info('Database', 'Settings updated');
      resolve(updated);
    };

    request.onerror = () => reject(request.error);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clean up old data to prevent database bloat
 */
export async function cleanupOldData(): Promise<void> {
  const database = await getDB();

  // Get sessions sorted by date
  const sessions = await getAllSessions();

  // Delete oldest sessions if over limit
  if (sessions.length > LIMITS.sessions) {
    const toDelete = sessions.slice(LIMITS.sessions);
    for (const session of toDelete) {
      await deleteSession(session.id);
    }
    info('Database', `Cleaned up ${toDelete.length} old sessions`);
  }

  // Could add similar cleanup for trends and alarms here
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  initDatabase,
  // Sessions
  saveSession,
  updateSession,
  loadSession,
  getAllSessions,
  deleteSession,
  // Trends
  archiveTrends,
  getSessionTrends,
  // Alarms
  saveAlarm,
  getSessionAlarms,
  // Presets
  savePreset,
  getPresets,
  deletePreset,
  // Settings
  getSettings,
  updateSettings,
  // Maintenance
  cleanupOldData,
};
