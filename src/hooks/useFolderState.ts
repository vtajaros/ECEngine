import { useState, useEffect, useCallback } from 'react'
import type { FolderRow } from '../types/window'

export interface UseFolderStateReturn {
  folderRows: FolderRow[]
  reloadFolders: () => Promise<void>
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>
  onDeleteFolder: (folderId: string) => Promise<void>
  onReorderFolders: (orderedIds: string[]) => Promise<void>
  onPromoteFolder: (folderId: string) => Promise<void>
  onNestFolder: (folderId: string, parentId: string) => Promise<void>
  onRenameFolder: (folderId: string, newName: string) => Promise<void>
  /** Resolve a folder_id (or legacy folder_name) to a FolderRow for filtering */
  getFolderById: (id: string) => FolderRow | undefined
  /** All folder IDs that are "under" a given folder (itself + children) */
  subtreeIds: (folderId: string) => string[]
}

export function useFolderState(onReload: () => Promise<void>): UseFolderStateReturn {
  const [folderRows, setFolderRows] = useState<FolderRow[]>([])

  const reloadFolders = useCallback(async () => {
    try {
      const res = await window.electron.folders.getAll()
      if (res.success && res.data) setFolderRows(res.data)
    } catch (e) {
      console.error('[useFolderState] Failed to load folders:', e)
    }
  }, [])

  useEffect(() => { reloadFolders() }, [reloadFolders])

  const getFolderById = useCallback(
    (id: string) => folderRows.find(f => f.id === id),
    [folderRows]
  )

  const subtreeIds = useCallback(
    (folderId: string): string[] => {
      const children = folderRows.filter(f => f.parent_id === folderId).map(f => f.id)
      return [folderId, ...children]
    },
    [folderRows]
  )

  const onCreateFolder = useCallback(async (name: string, parentId?: string | null) => {
    const res = await window.electron.folders.create(name, parentId)
    if (res.success) {
      await reloadFolders()
      await onReload()
    } else {
      console.error('[useFolderState] Create folder failed:', res.error)
    }
  }, [reloadFolders, onReload])

  const onDeleteFolder = useCallback(async (folderId: string) => {
    const res = await window.electron.folders.delete(folderId)
    if (res.success) {
      await reloadFolders()
      await onReload()
    } else {
      console.error('[useFolderState] Delete folder failed:', res.error)
    }
  }, [reloadFolders, onReload])

  const onReorderFolders = useCallback(async (orderedIds: string[]) => {
    const orders = orderedIds.map((id, index) => ({ id, order_index: index }))
    const res = await window.electron.folders.reorder(orders)
    if (res.success) {
      await reloadFolders()
    } else {
      console.error('[useFolderState] Reorder failed:', res.error)
    }
  }, [reloadFolders])

  const onPromoteFolder = useCallback(async (folderId: string) => {
    const res = await window.electron.folders.setParent(folderId, null)
    if (res.success) {
      await reloadFolders()
    } else {
      console.error('[useFolderState] Promote failed:', res.error)
    }
  }, [reloadFolders])

  const onNestFolder = useCallback(async (folderId: string, parentId: string) => {
    const res = await window.electron.folders.setParent(folderId, parentId)
    if (res.success) {
      await reloadFolders()
    } else {
      console.error('[useFolderState] Nest failed:', res.error)
    }
  }, [reloadFolders])

  const onRenameFolder = useCallback(async (folderId: string, newName: string) => {
    const res = await window.electron.folders.rename(folderId, newName)
    if (res.success) {
      await reloadFolders()
    } else {
      console.error('[useFolderState] Rename failed:', res.error)
    }
  }, [reloadFolders])

  return {
    folderRows,
    reloadFolders,
    onCreateFolder,
    onDeleteFolder,
    onReorderFolders,
    onPromoteFolder,
    onNestFolder,
    onRenameFolder,
    getFolderById,
    subtreeIds,
  }
}
