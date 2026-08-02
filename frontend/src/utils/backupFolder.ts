const DB_NAME = 'pwa_fin_backup_fs'
const DB_VERSION = 1
const STORE_NAME = 'handles'
const HANDLE_KEY = 'backupDirectory'
const STORAGE_FOLDER_NAME = 'pwa_fin_backup_folder_name'

type PermissionMode = { mode?: 'read' | 'readwrite' }

type DirectoryHandleLike = {
  kind: 'directory'
  name: string
  queryPermission: (descriptor?: PermissionMode) => Promise<PermissionState>
  requestPermission: (descriptor?: PermissionMode) => Promise<PermissionState>
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob | string) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}

declare global {
  interface Window {
    Capacitor?: unknown
    showDirectoryPicker?: (options?: {
      id?: string
      mode?: 'read' | 'readwrite'
      startIn?: string
    }) => Promise<DirectoryHandleLike>
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

async function idbGetHandle(): Promise<DirectoryHandleLike | null> {
  const db = await openDb()

  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(HANDLE_KEY)

      request.onerror = () => reject(request.error ?? new Error('IndexedDB get failed'))
      request.onsuccess = () => resolve((request.result as DirectoryHandleLike | undefined) ?? null)
    })
  } finally {
    db.close()
  }
}

async function idbSetHandle(handle: DirectoryHandleLike): Promise<void> {
  const db = await openDb()

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(handle, HANDLE_KEY)

      request.onerror = () => reject(request.error ?? new Error('IndexedDB put failed'))
      request.onsuccess = () => resolve()
    })
  } finally {
    db.close()
  }
}

async function idbClearHandle(): Promise<void> {
  const db = await openDb()

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(HANDLE_KEY)

      request.onerror = () => reject(request.error ?? new Error('IndexedDB delete failed'))
      request.onsuccess = () => resolve()
    })
  } finally {
    db.close()
  }
}

/** Выбор папки доступен в десктопном Chrome/Edge (не в Capacitor / Safari) */
export function isBackupFolderPickerSupported(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  if (window.Capacitor) {
    return false
  }

  return typeof window.showDirectoryPicker === 'function'
}

/** Отображаемое имя выбранной папки */
export function getBackupFolderName(): string | null {
  try {
    return localStorage.getItem(STORAGE_FOLDER_NAME)
  } catch {
    return null
  }
}

function setBackupFolderName(name: string | null): void {
  if (name) {
    localStorage.setItem(STORAGE_FOLDER_NAME, name)
  } else {
    localStorage.removeItem(STORAGE_FOLDER_NAME)
  }
}

async function ensureWritePermission(handle: DirectoryHandleLike): Promise<boolean> {
  const opts: PermissionMode = { mode: 'readwrite' }

  if ((await handle.queryPermission(opts)) === 'granted') {
    return true
  }

  return (await handle.requestPermission(opts)) === 'granted'
}

/** Диалог выбора папки и сохранение handle */
export async function pickBackupFolder(): Promise<string> {
  if (!isBackupFolderPickerSupported() || !window.showDirectoryPicker) {
    throw new Error('Выбор папки не поддерживается в этом браузере')
  }

  const handle = await window.showDirectoryPicker({
    id: 'pwa-fin-backup',
    mode: 'readwrite',
    startIn: 'documents'
  })

  await idbSetHandle(handle)
  setBackupFolderName(handle.name)

  return handle.name
}

/** Сбросить выбранную папку */
export async function clearBackupFolder(): Promise<void> {
  await idbClearHandle()
  setBackupFolderName(null)
}

/**
 * Записать файл в выбранную папку.
 * @returns true если записали, false если папка не выбрана / нет доступа
 */
export async function writeBackupToFolder(filename: string, blob: Blob): Promise<boolean> {
  if (!isBackupFolderPickerSupported()) {
    return false
  }

  const handle = await idbGetHandle()

  if (!handle) {
    return false
  }

  const allowed = await ensureWritePermission(handle)

  if (!allowed) {
    return false
  }

  const fileHandle = await handle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()

  setBackupFolderName(handle.name)

  return true
}
