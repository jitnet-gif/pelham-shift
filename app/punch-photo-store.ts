// 출퇴근 사진은 서버에 가지 않습니다. 찍은 기기 안에만 남습니다.
// localStorage 는 한 장에 수백 KB 인 사진 몇 장이면 꽉 차므로 IndexedDB 를 씁니다.
// 사생활 보호 모드나 저장 공간이 막힌 기기에서는 그냥 실패합니다 — 사진이 없다고 출퇴근이 막히면 안 됩니다.
const DB = 'pelham-punch-photos';
const STORE = 'photos';
// 기기에 얼굴 사진을 한없이 쌓아 두지 않습니다. 급여를 확인하는 동안이면 충분합니다.
const KEEP_DAYS = 60;

type Row = { key: string; photo: string; savedAt: number };
const keyOf = (punchId: string, kind: 'in' | 'out') => punchId + ':' + kind;

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function savePunchPhoto(punchId: string, kind: 'in' | 'out', photo: string) {
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ key: keyOf(punchId, kind), photo, savedAt: Date.now() } satisfies Row);
  } catch {
    // 저장 공간이 없으면 사진만 없습니다. 찍힌 출퇴근은 이미 서버에 남았습니다.
  }
}

export async function readPunchPhoto(punchId: string, kind: 'in' | 'out') {
  const db = await open();
  if (!db) return null;
  return new Promise<string | null>((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(keyOf(punchId, kind));
      request.onsuccess = () => resolve((request.result as Row | undefined)?.photo ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// 오래된 사진을 치웁니다. 화면을 열 때 한 번만 돌면 충분합니다.
export async function prunePunchPhotos() {
  const db = await open();
  if (!db) return;
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const cutoff = Date.now() - KEEP_DAYS * 86400000;
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if ((cursor.value as Row).savedAt < cutoff) cursor.delete();
      cursor.continue();
    };
  } catch {
    // 치우지 못해도 그만입니다.
  }
}
