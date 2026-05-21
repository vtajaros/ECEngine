import React from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Folder } from 'lucide-react';

interface FolderPanelProps {
  folders: string[];
  deckCountByFolder: Record<string, number>;
  totalDeckCount: number;
  selected: string | 'all';
  onSelect: (folder: string | 'all') => void;
}

const FolderPanel: React.FC<FolderPanelProps> = ({
  folders,
  deckCountByFolder,
  totalDeckCount,
  selected,
  onSelect,
}) => {
  const sortedFolders = [...folders].sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  return (
    <div
      className="flex-shrink-0 bg-[var(--bg-primary)] overflow-x-auto sm:overflow-y-auto sm:overflow-x-hidden flex flex-row sm:flex-col sm:w-[240px] sm:h-full sm:border-r border-b sm:border-b-0 border-[var(--bg-card)] w-full"
      style={{ padding: '8px 12px', scrollbarWidth: 'none' }}
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
            className={`flex items-center gap-2 px-3 py-1.5 sm:py-2.5 rounded-full sm:rounded-r-md sm:w-full sm:justify-between sm:gap-3 border sm:border-l-[3px] sm:border-t-0 sm:border-r-0 sm:border-b-0 whitespace-nowrap group ${
              selected === 'all'
                ? 'bg-[var(--bg-card)] border-[var(--accent-primary)]'
                : 'bg-transparent border-[var(--bg-card)] hover:bg-[var(--bg-secondary)]'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <LayoutGrid
                size={16}
                className={`hidden sm:block ${selected === 'all' ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors'}`}
              />
              <span 
                className={`text-[13px] truncate font-bold font-['Rajdhani'] uppercase tracking-wider ${selected === 'all' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                }`}
                title="All Folders"
              >
                All
              </span>
            </div>
            <div className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-mono border border-[var(--bg-elevated)]">
              {totalDeckCount}
            </div>
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
                className={`flex items-center gap-2 px-3 py-1.5 sm:py-2.5 rounded-full sm:rounded-r-md sm:w-full sm:justify-between sm:gap-3 border sm:border-l-[3px] sm:border-t-0 sm:border-r-0 sm:border-b-0 whitespace-nowrap group ${
                  isSelected
                    ? 'bg-[var(--bg-card)] border-[var(--accent-primary)]'
                    : 'bg-transparent border-[var(--bg-card)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Folder
                    size={16}
                    className={`hidden sm:block ${isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors'}`}
                  />
                  <span 
                    className={`text-[13px] truncate font-bold font-['Rajdhani'] uppercase tracking-wider ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                    }`}
                    title={folder}
                  >
                    {folder}
                  </span>
                </div>
                <div className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-mono border border-[var(--bg-elevated)]">
                  {count}
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
