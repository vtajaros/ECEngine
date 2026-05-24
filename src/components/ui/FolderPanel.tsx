import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Folder, Trash2, GripVertical, Pencil, Check, X, AlertTriangle } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FolderPanelProps {
  folders: string[];
  deckCountByFolder: Record<string, number>;
  totalDeckCount: number;
  selected: string | 'all';
  onSelect: (folder: string | 'all') => void;
  onDeleteFolder?: (folderId: string) => void;
  onReorderFolders?: (newOrder: string[]) => void;
}

const SortableFolderItem: React.FC<{
  folder: string;
  isEditing: boolean;
  isSelected: boolean;
  deckCount: number;
  onSelect: (f: string | 'all') => void;
  onDeleteFolder?: (f: string) => void;
  onRequestDelete?: (f: string) => void;
}> = ({ folder, isEditing, isSelected, deckCount, onSelect, onDeleteFolder, onRequestDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {isEditing ? (
        <div
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm border border-transparent hover:bg-slate-800/50"
        >
          {/* Left (Rearrange Handle) */}
          {folder === 'Uncategorized' ? (
            <div className="w-3.5" />
          ) : (
            <div
              {...attributes}
              {...listeners}
              className="p-1 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-[var(--text-primary)] hover:text-green-500 transition-colors"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          {/* Center (Rename Input) */}
          <input
            type="text"
            defaultValue={folder}
            readOnly={true}
            className="flex-1 min-w-0 w-full bg-transparent text-[13px] font-bold font-['Rajdhani'] uppercase tracking-wider text-[var(--text-secondary)] border-b border-transparent focus:outline-none focus:ring-0 p-0 m-0"
          />

          {/* Right (Trash Icon / Delete button) */}
          {folder === 'Uncategorized' ? (
            <div className="w-3.5" />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestDelete?.(folder);
              }}
              className="p-0.5 shrink-0 flex items-center justify-center bg-transparent border-0 cursor-pointer text-[var(--text-primary)] hover:text-red-400 transition-colors"
              title="Delete Folder"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>
      ) : (
        <motion.button
          whileHover={{ scale: 1.01 }}
          onClick={() => onSelect(folder)}
          title={folder}
          className={`min-w-0 flex items-center justify-between w-full gap-2 px-3 py-2.5 rounded-md border-l-[3px] border-t-0 border-r-0 border-b-0 border-transparent whitespace-nowrap group ${
            isSelected
              ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--accent-primary)]'
              : 'bg-transparent text-[var(--text-secondary)] border-l-transparent hover:bg-[var(--bg-secondary)]'
          }`}
        >
          {/* Wrapper 1 (Left - Icon & Name) */}
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <Folder 
              className={`shrink-0 ${isSelected 
                ? 'text-[var(--accent-primary)]' 
                : 'text-[var(--text-primary)] group-hover:text-[var(--text-primary)]'
              }`} 
              size={15} 
            />
            <span
              className={`text-[13px] truncate block max-w-full font-bold font-['Rajdhani'] uppercase tracking-wider ${
                isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
              }`}
              title={folder}
            >
              {folder}
            </span>
          </div>

          {/* Wrapper 2 (Right - Actions & Count) */}
          <div className="flex items-center flex-shrink-0 w-8 justify-end">
            <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-mono border border-[var(--bg-elevated)]">
              {deckCount}
            </span>
          </div>
        </motion.button>
      )}
    </div>
  );
};

const FolderPanel: React.FC<FolderPanelProps> = ({
  folders,
  deckCountByFolder,
  totalDeckCount,
  selected,
  onSelect,
  onDeleteFolder,
  onReorderFolders,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const sortableFolders = folders.filter((f) => f !== 'Uncategorized');

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableFolders.indexOf(active.id as string);
    const newIndex = sortableFolders.indexOf(over.id as string);
    const newOrder = arrayMove(sortableFolders, oldIndex, newIndex);
    
    // Pass the new full folder list back (including Uncategorized at the end)
    onReorderFolders?.([...newOrder, 'Uncategorized']);
  };

  return (
    <div
      className="flex-shrink-0 bg-[var(--bg-primary)] overflow-y-auto overflow-x-hidden flex flex-col w-[200px] h-full border-r border-[var(--bg-card)] py-4 px-2"
    >
      <div className="flex flex-col items-stretch gap-0 px-4">
        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="text-[var(--text-secondary)] text-[10px] uppercase tracking-[0.15em] font-bold">
            FOLDERS
          </h2>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="group text-slate-400 hover:text-green-500 transition-colors p-1 rounded hover:bg-slate-800/50 outline-none focus:outline-none focus-visible:ring-0 focus-visible:text-green-500"
            title={isEditing ? 'Done' : 'Edit'}
          >
            {isEditing ? (
              <Check className="w-3 h-3 text-[var(--text-primary)]" />
            ) : (
              <Pencil className="w-3 h-3 text-[var(--text-primary)]" />
            )}
          </button>
        </div>

        <motion.div className="flex flex-col gap-1">
          {/* All Row */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            onClick={() => onSelect('all')}
            title="All Folders"
            className={`min-w-0 flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-md border-l-[3px] border-t-0 border-r-0 border-b-0 border-transparent whitespace-nowrap group ${
              selected === 'all'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--accent-primary)]'
                : 'bg-transparent text-[var(--text-secondary)] border-l-transparent hover:bg-[var(--bg-secondary)]'
            }`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <LayoutGrid
                size={15}
                className={`shrink-0 ${selected === 'all' ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors'}`}
              />
              <span
                className={`text-[13px] truncate font-bold font-['Rajdhani'] uppercase tracking-wider ${
                  selected === 'all' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                }`}
                title="All Folders"
              >
                All
              </span>
            </div>
            <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-mono border border-[var(--bg-elevated)]">
              {totalDeckCount}
            </span>
          </motion.button>

          {/* Sortable Folder Context */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortableFolders}
              strategy={verticalListSortingStrategy}
            >
              {sortableFolders.map((folder) => (
                <SortableFolderItem
                  key={folder}
                  folder={folder}
                  isEditing={isEditing}
                  isSelected={selected === folder}
                  deckCount={deckCountByFolder[folder] || 0}
                  onSelect={onSelect}
                  onDeleteFolder={onDeleteFolder}
                  onRequestDelete={(f) => setFolderToDelete(f)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Uncategorized Row (Static at the bottom) */}
          {!isEditing && folders.includes('Uncategorized') && (
            <SortableFolderItem
              folder="Uncategorized"
              isEditing={isEditing}
              isSelected={selected === 'Uncategorized'}
              deckCount={deckCountByFolder['Uncategorized'] || 0}
              onSelect={onSelect}
              onDeleteFolder={onDeleteFolder}
              onRequestDelete={(f) => setFolderToDelete(f)}
            />
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {folderToDelete && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFolderToDelete(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#FF003C] to-transparent" />
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#FF003C]/10 border border-[#FF003C]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,0,60,0.1)]">
                  <AlertTriangle className="w-8 h-8 text-[#FF003C]" />
                </div>
                <h3 className="text-2xl font-['Orbitron'] font-bold text-white mb-4 tracking-widest uppercase">
                  DELETE FOLDER?
                </h3>
                <p className="text-[#888] font-['IBM_Plex_Mono'] mb-8 leading-relaxed">
                  Are you absolutely sure you want to delete{' '}
                  <strong className="text-white">{folderToDelete}</strong>?{' '}
                  All decks inside will be moved to Uncategorized.
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => {
                      onDeleteFolder?.(folderToDelete)
                      setFolderToDelete(null)
                    }}
                    className="w-full py-4 bg-[#FF003C] hover:bg-[#D00030] text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,0,60,0.2)] hover:shadow-[0_0_25px_rgba(255,0,60,0.4)]"
                  >
                    CONFIRM DELETE
                  </button>
                  <button
                    onClick={() => setFolderToDelete(null)}
                    className="w-full py-4 bg-[#1A1A1A] border border-[#333] hover:border-[#555] text-[#888] hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
              <button
                onClick={() => setFolderToDelete(null)}
                className="absolute top-4 right-4 text-[#444] hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FolderPanel;
