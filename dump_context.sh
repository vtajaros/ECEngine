#!/usr/bin/env bash
PROJ="C:/Users/LG/Desktop/ecengine"
cd "$PROJ" || { echo "ERROR: $PROJ not found"; exit 1; }

_dump_file()  { echo "===== FILE: $1 ====="; cat "$1" 2>/dev/null || echo "[NOT FOUND]"; echo ""; }
_dump_range() { echo "===== FILE: $1 (lines $2-$3) ====="; sed -n "${2},${3}p" "$1" 2>/dev/null || echo "[NOT FOUND]"; echo ""; }
_dump_grep()  { echo "===== GREP [$2] in $1 ====="; grep -n "$2" "$1" 2>/dev/null || echo "[no matches]"; echo ""; }

case "${1:-full}" in
  full)
    for f in \
      src/hooks/useTTS.ts \
      src/pages/FlashcardViewer.tsx \
      src/pages/FlashcardStudy.tsx \
      src/components/flashcard/FlashCard.tsx \
      src/components/flashcard/FlashCardSettingsModal.tsx \
      src/lib/subjectColors.ts \
      src/services/db.service.ts \
      electron/ipc/db.ipc.ts \
      electron/db/schema.sql \
      src/router.tsx \
      src/types/index.ts
    do _dump_file "$f"; done ;;
  file)  _dump_file "$2" ;;
  range) _dump_range "$2" "$3" "$4" ;;
  grep)  _dump_grep "$2" "$3" ;;
  ls)    find "${2:-.}" -maxdepth 2 -not -path '*/node_modules/*' -not -path '*/.git/*' | sort ;;
  build) npx tsc --noEmit 2>&1 ;;
  *)     echo "Commands: full | file <path> | range <path> <start> <end> | grep <path> <pattern> | ls [dir] | build" ;;
esac
