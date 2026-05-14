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
    <div className="w-[220px] h-full flex flex-col border-r border-[var(--bg-elevated)] bg-[var(--bg-primary)] flex-shrink-0 pl-2 pt-6">
      <div className="px-4">
        <h2 className="text-[var(--text-secondary)] text-[10px] uppercase tracking-[0.15em] font-bold mb-6">
          Your folders
        </h2>

        <motion.div layout className="flex flex-col gap-1">
          {/* All Row */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            onClick={() => onSelect('all')}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 transition-all duration-200 rounded-r-md border-l-[3px] group ${
              selected === 'all'
                ? 'bg-[var(--bg-card)] border-[var(--accent-primary)]'
                : 'bg-transparent border-transparent hover:bg-[var(--bg-secondary)]'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <LayoutGrid 
                size={16} 
                className={selected === 'all' ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors'} 
              />
              <span className={`text-sm truncate font-medium ${
                selected === 'all' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
              }`}>
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
                layout
                whileHover={{ scale: 1.01 }}
                onClick={() => onSelect(folder)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 transition-all duration-200 rounded-r-md border-l-[3px] group ${
                  isSelected
                    ? 'bg-[var(--bg-card)] border-[var(--accent-primary)]'
                    : 'bg-transparent border-transparent hover:bg-[var(--bg-secondary)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Folder 
                    size={16} 
                    className={isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors'} 
                  />
                  <span className={`text-sm truncate font-medium ${
                    isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                  }`}>
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
