/** Atomic cross-tab claim. Failure disables alerts rather than risking duplicates. */
export async function claimMessageAlert(userId: string, messageId: string): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  return new Promise((resolve) => {
    const opening = indexedDB.open("playground-message-alerts", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("claims", { keyPath: "id" });
    opening.onerror = () => resolve(false);
    opening.onsuccess = () => {
      const db = opening.result,
        tx = db.transaction("claims", "readwrite"),
        store = tx.objectStore("claims");
      let claimed = false;
      const request = store.add({ id: `${userId}:${messageId}`, userId, at: Date.now() });
      request.onsuccess = () => {
        claimed = true;
      };
      request.onerror = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (row) {
          if (row.value.at < Date.now() - 86400000) row.delete();
          row.continue();
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(claimed);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    };
  });
}
export async function clearMessageAlerts(userId: string) {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.open("playground-message-alerts", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("claims", { keyPath: "id" });
    req.onerror = () => resolve();
    req.onsuccess = () => {
      const db = req.result,
        tx = db.transaction("claims", "readwrite"),
        cursor = tx.objectStore("claims").openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (row) {
          if (row.value.userId === userId) row.delete();
          row.continue();
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    };
  });
}
