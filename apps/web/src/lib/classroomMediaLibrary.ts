export type ClassroomMediaKind = "document" | "image" | "video" | "audio";
export type DocumentSourceFormat = "pdf" | "ppt" | "pptx";

export interface ClassroomMaterialViewState {
  page: number;
  zoom: number;
  panX: number;
  panY: number;
  currentTime: number;
  playbackRate: number;
  volume: number;
  wasPlaying: boolean;
}

export interface ClassroomMaterialRecord {
  key: string;
  sessionId: string;
  id: string;
  title: string;
  kind: ClassroomMediaKind;
  sourceFormat?: DocumentSourceFormat;
  source: Blob;
  thumbnail?: Blob;
  documentManifest?: {
    version: number;
    pageCount: number;
    mimeType: string;
    pages: string[];
    warning?: string | null;
  };
  state: ClassroomMaterialViewState;
  createdAt: number;
  expiresAt: number;
}

export interface ClassroomLibraryState {
  sessionId: string;
  selectedId: string | null;
  desiredVisible: boolean;
  updatedAt: number;
  expiresAt: number;
}

const DB_NAME = "classroom-media-library";
const DB_VERSION = 1;
const MATERIALS = "materials";
const LIBRARIES = "libraries";
export const CLASSROOM_MEDIA_TTL_MS = 12 * 60 * 60_000;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MATERIALS)) {
        const store = db.createObjectStore(MATERIALS, { keyPath: "key" });
        store.createIndex("sessionId", "sessionId", { unique: false });
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(LIBRARIES)) {
        db.createObjectStore(LIBRARIES, { keyPath: "sessionId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function loadClassroomLibrary(sessionId: string): Promise<{
  materials: ClassroomMaterialRecord[];
  state: ClassroomLibraryState | null;
}> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction([MATERIALS, LIBRARIES], "readonly");
    const materials = await requestResult(
      transaction.objectStore(MATERIALS).index("sessionId").getAll(sessionId)
    ) as ClassroomMaterialRecord[];
    const state = await requestResult(
      transaction.objectStore(LIBRARIES).get(sessionId)
    ) as ClassroomLibraryState | undefined;
    await transactionDone(transaction);
    const now = Date.now();
    return {
      materials: materials.filter((material) => material.expiresAt > now).sort((a, b) => a.createdAt - b.createdAt),
      state: state && state.expiresAt > now ? state : null
    };
  } finally {
    db.close();
  }
}

export async function saveClassroomMaterial(material: ClassroomMaterialRecord): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(MATERIALS, "readwrite");
    transaction.objectStore(MATERIALS).put(material);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function saveClassroomLibraryState(state: ClassroomLibraryState): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(LIBRARIES, "readwrite");
    transaction.objectStore(LIBRARIES).put(state);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function removeClassroomMaterial(sessionId: string, id: string): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(MATERIALS, "readwrite");
    transaction.objectStore(MATERIALS).delete(`${sessionId}:${id}`);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function clearClassroomLibrary(sessionId: string): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction([MATERIALS, LIBRARIES], "readwrite");
    const materialStore = transaction.objectStore(MATERIALS);
    const keys = await requestResult(materialStore.index("sessionId").getAllKeys(sessionId));
    for (const key of keys) materialStore.delete(key);
    transaction.objectStore(LIBRARIES).delete(sessionId);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function purgeExpiredClassroomMedia(now = Date.now()): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction([MATERIALS, LIBRARIES], "readwrite");
    const materialStore = transaction.objectStore(MATERIALS);
    const cursorRequest = materialStore.index("expiresAt").openCursor(IDBKeyRange.upperBound(now));
    await new Promise<void>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return resolve();
        cursor.delete();
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
    const libraries = await requestResult(transaction.objectStore(LIBRARIES).getAll()) as ClassroomLibraryState[];
    for (const state of libraries) {
      if (state.expiresAt <= now) transaction.objectStore(LIBRARIES).delete(state.sessionId);
    }
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export function defaultMaterialViewState(): ClassroomMaterialViewState {
  return {
    page: 1,
    zoom: 1,
    panX: 0,
    panY: 0,
    currentTime: 0,
    playbackRate: 1,
    volume: 1,
    wasPlaying: false
  };
}
