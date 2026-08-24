export interface SoloDrawingDraftStore {
  load(): Promise<Uint8Array[]>;
  append(update: Uint8Array): Promise<void>;
  replaceWithSnapshot(update: Uint8Array): Promise<void>;
  clear(): Promise<void>;
}

interface DraftRecord {
  key: string;
  sequence: number;
  update: ArrayBuffer;
}

const DATABASE_NAME = "playground-solo-drawing-drafts";
const STORE_NAME = "updates";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_request_failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("indexeddb_transaction_aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("indexeddb_transaction_failed"));
  });
}

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: ["key", "sequence"] });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_open_failed"));
  });
}

function keyRange(key: string): IDBKeyRange {
  return IDBKeyRange.bound([key, 0], [key, Number.MAX_SAFE_INTEGER]);
}

function deleteKeyRecords(store: IDBObjectStore, key: string, done: () => void): void {
  const cursorRequest = store.openCursor(keyRange(key));
  cursorRequest.onerror = () => store.transaction.abort();
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) {
      done();
      return;
    }
    cursor.delete();
    cursor.continue();
  };
}

export class IndexedDbSoloDrawingDraftStore implements SoloDrawingDraftStore {
  private nextSequence = 0;
  private loaded = false;
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly key: string) {}

  async load(): Promise<Uint8Array[]> {
    await this.writes;
    const database = await openDraftDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const records = await requestResult(
        transaction.objectStore(STORE_NAME).getAll(keyRange(this.key)) as IDBRequest<DraftRecord[]>
      );
      await transactionDone(transaction);
      records.sort((left, right) => left.sequence - right.sequence);
      this.nextSequence = records.at(-1)?.sequence ?? 0;
      this.loaded = true;
      return records.map((record) => new Uint8Array(record.update));
    } finally {
      database.close();
    }
  }

  append(update: Uint8Array): Promise<void> {
    const copied = update.slice().buffer;
    return this.enqueue(async () => {
      await this.ensureLoaded();
      const database = await openDraftDatabase();
      try {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        this.nextSequence += 1;
        transaction.objectStore(STORE_NAME).put({
          key: this.key,
          sequence: this.nextSequence,
          update: copied
        } satisfies DraftRecord);
        await transactionDone(transaction);
      } finally {
        database.close();
      }
    });
  }

  replaceWithSnapshot(update: Uint8Array): Promise<void> {
    const copied = update.slice().buffer;
    return this.enqueue(async () => {
      const database = await openDraftDatabase();
      try {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        deleteKeyRecords(store, this.key, () => {
          store.put({ key: this.key, sequence: 1, update: copied } satisfies DraftRecord);
        });
        await transactionDone(transaction);
        this.nextSequence = 1;
        this.loaded = true;
      } finally {
        database.close();
      }
    });
  }

  clear(): Promise<void> {
    return this.enqueue(async () => {
      const database = await openDraftDatabase();
      try {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        deleteKeyRecords(transaction.objectStore(STORE_NAME), this.key, () => {});
        await transactionDone(transaction);
        this.nextSequence = 0;
        this.loaded = true;
      } finally {
        database.close();
      }
    });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.writes.then(operation, operation);
    this.writes = next.catch(() => {});
    return next;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const database = await openDraftDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const records = await requestResult(
        transaction.objectStore(STORE_NAME).getAll(keyRange(this.key)) as IDBRequest<DraftRecord[]>
      );
      await transactionDone(transaction);
      this.nextSequence = records.reduce((maximum, record) => Math.max(maximum, record.sequence), 0);
      this.loaded = true;
    } finally {
      database.close();
    }
  }
}
