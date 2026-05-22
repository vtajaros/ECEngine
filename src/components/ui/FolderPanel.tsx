import React from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Folder, Trash2 } from 'lucide-react';

interface FolderPanelProps {
  folders: string[];
  deckCountByFolder: Record<string, number>;
  totalDeckCount: number;
  selected: string | 'all';
  onSelect: (folder: string | 'all') => void;
  onDeleteFolder?: (folderId: string) => void;
}

const FolderPanel: React.FC<FolderPanelProps> = ({
  folders,
  deckCountByFolder,
  totalDeckCount,
  selected,
  onSelect,
  onDeleteFolder,
}) => {
  const sortedFolders = [...folders].sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  return (
    <div
      className="flex-shrink-0 bg-[var(--bg-primary)] overflow-x-auto sm:overflow-y-auto sm:overflow-x-hidden flex flex-row sm:flex-col sm:w-[200px] sm:h-full sm:border-r border-b sm:border-b-0 border-[var(--bg-card)] w-full py-2 sm:py-4 px-3 sm:px-2 max-sm:[&::-webkit-scrollbar]:hidden max-sm:[scrollbar-width:none]"
    >
      <div className="flex flex-row sm:flex-col items-center sm:items-stretch gap-2 sm:gap-0 min-w-max sm:min-w-0 sm:px-4">
        <h2 className="hidden sm:block text-[var(--text-secondary)] text-[10px] uppercase tracking-[0.15em] font-bold mb-6">
          Your folders
        </h2>

        <motion.div className="flex flex-row sm:flex-col gap-2 sm:gap-1">
          {/* All Row */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            onClick={() => onSelect('all')}
            title="All Folders"
            className={`min-w-0 flex items-center gap-2 px-3 py-1.5 sm:py-2.5 rounded-full sm:rounded-md sm:w-full sm:justify-between sm:gap-3 border border-transparent sm:border-l-[3px] sm:border-t-0 sm:border-r-0 sm:border-b-0 whitespace-nowrap group ${
              selected === 'all'
                ? 'bg-[#00FF41]/10 text-[#00FF41] border-transparent sm:bg-[var(--bg-card)] sm:text-[var(--text-primary)] sm:border-[var(--accent-primary)]'
                : 'bg-slate-800/50 text-slate-400 border-transparent sm:bg-transparent sm:text-[var(--text-secondary)] sm:border-l-transparent sm:hover:bg-[var(--bg-secondary)]'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <LayoutGrid
                size={16}
                className={`hidden sm:block ${selected === 'all' ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors'}`}
              />
              <span 
                className={`text-[13px] truncate font-bold font-['Rajdhani'] uppercase tracking-wider ${
                  selected === 'all' 
                    ? 'text-[#00FF41] sm:text-[var(--text-primary)]' 
                    : 'text-slate-400 sm:text-[var(--text-secondary)] sm:group-hover:text-[var(--text-primary)]'
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

          {/* Folder Rows */}
          {sortedFolders.map((folder) => {
            const isSelected = selected === folder;
            const count = deckCountByFolder[folder] || 0;

            return (
              <motion.button
                key={folder}
                whileHover={{ scale: 1.01 }}
                onClick={() => onSelect(folder)}
                title={folder}
                className={`min-w-0 flex items-center justify-between w-full gap-3 px-3 py-1.5 sm:py-2.5 rounded-full sm:rounded-md border border-transparent sm:border-l-[3px] sm:border-t-0 sm:border-r-0 sm:border-b-0 whitespace-nowrap group ${
                  isSelected
                    ? 'bg-[#00FF41]/10 text-[#00FF41] border-transparent sm:bg-[var(--bg-card)] sm:text-[var(--text-primary)] sm:border-[var(--accent-primary)]'
                    : 'bg-slate-800/50 text-slate-400 border-transparent sm:bg-transparent sm:text-[var(--text-secondary)] sm:border-l-transparent sm:hover:bg-[var(--bg-secondary)]'
                }`}
              >
                {/* Wrapper 1 (Left - Icon & Name) */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Folder
                    size={16}
                    className={`hidden sm:block ${isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors'}`}
                  />
                  <span 
                    className={`text-[13px] truncate font-bold font-['Rajdhani'] uppercase tracking-wider ${
                      isSelected 
                        ? 'text-[#00FF41] sm:text-[var(--text-primary)]' 
                        : 'text-slate-400 sm:text-[var(--text-secondary)] sm:group-hover:text-[var(--text-primary)]'
                    }`}
                    title={folder}
                  >
                    {folder}
                  </span>
                </div>

                {/* Wrapper 2 (Right - Actions & Count) */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {onDeleteFolder && folder !== 'Uncategorized' && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder?.(folder);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          onDeleteFolder?.(folder);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400 p-0.5 cursor-pointer flex items-center justify-center"
                      title="Delete Folder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-mono border border-[var(--bg-elevated)]">
                    {count}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};

export default FolderPanel;
