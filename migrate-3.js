const fs = require('fs');
const file = 'src/pages/AddDeck.tsx';
let content = fs.readFileSync(file, 'utf8');

// Helper: replace first occurrence only, fail loudly if not found
function rep(search, replacement, label) {
  if (!content.includes(search)) {
    console.error('NOT FOUND:', label);
    process.exit(1);
  }
  content = content.replace(search, replacement);
}

// 1. Replace state block (CRLF aware)
rep(
  "  const [title, setTitle] = useState('')\r\n  const [description, setDescription] = useState('')\r\n  const [folderName, setFolderName] = useState('')\r\n  const [existingFolders, setExistingFolders] = useState<string[]>([])\r\n  const [showFolderDropdown, setShowFolderDropdown] = useState(false)\r\n  const folderDropdownRef = React.useRef<HTMLDivElement>(null)\r\n  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)\r\n\r\n  useEffect(() => {\r\n    return () => {\r\n      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)\r\n    }\r\n  }, [])\r\n\r\n  useEffect(() => {\r\n    function handleClickOutside(event: MouseEvent) {\r\n      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {\r\n        setShowFolderDropdown(false)\r\n      }\r\n    }\r\n    document.addEventListener('mousedown', handleClickOutside)\r\n    return () => document.removeEventListener('mousedown', handleClickOutside)\r\n  }, [])\r\n  const [subject, setSubject] = useState<Subject>('Electronics Engineering')\r\n  const [deckTags, setDeckTags] = useState<Set<string>>(new Set())\r\n  const [customTagInput, setCustomTagInput] = useState('')",
  "  const [metadata, setMetadata] = useState({\n    title: '',\n    description: '',\n    subject: 'Electronics Engineering' as Subject,\n    customTagInput: '',\n    folderName: '',\n    existingFolders: [] as string[],\n    showFolderDropdown: false,\n    deckTags: [] as string[],\n  })\n  const folderDropdownRef = React.useRef<HTMLDivElement>(null)\n  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)\n\n  useEffect(() => {\n    return () => {\n      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)\n    }\n  }, [])\n\n  useEffect(() => {\n    function handleClickOutside(event: MouseEvent) {\n      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {\n        setMetadata(prev => ({ ...prev, showFolderDropdown: false }))\n      }\n    }\n    document.addEventListener('mousedown', handleClickOutside)\n    return () => document.removeEventListener('mousedown', handleClickOutside)\n  }, [])",
  'state block'
);

// 2. setExistingFolders
rep(
  '      setExistingFolders(folderNames)',
  '      setMetadata(prev => ({ ...prev, existingFolders: folderNames }))',
  'setExistingFolders'
);

// 3. setSubject in auto-detect
rep(
  '      setSubject(first.subject)',
  '      setMetadata(prev => ({ ...prev, subject: first.subject }))',
  'setSubject auto-detect'
);

// 4. canSave
rep(
  '  const canSave = title.trim().length > 0 && validCards.length > 0',
  '  const canSave = metadata.title.trim().length > 0 && validCards.length > 0',
  'canSave'
);

// 5. handleSave try block + destructure
rep(
  "    try {\r\n      const topicId = 'topic_' + Date.now().toString(36)\r\n\r\n      const payload = {\r\n        topicId,\r\n        name: title.trim(),\r\n        subject: subject,\r\n        description: description.trim(),\r\n        tags: JSON.stringify(Array.from(deckTags)),\r\n        folderName: folderName.trim(),",
  "    const { title, description, subject, folderName, deckTags } = metadata\n\n    try {\n      const topicId = 'topic_' + Date.now().toString(36)\n\n      const payload = {\n        topicId,\n        name: title.trim(),\n        subject: subject,\n        description: description.trim(),\n        tags: JSON.stringify(deckTags),\n        folderName: folderName.trim(),",
  'handleSave'
);

// 6. title input
rep(
  "                value={title}\r\n                onChange={e => setTitle(e.target.value)}",
  "                value={metadata.title}\n                onChange={e => setMetadata(prev => ({ ...prev, title: e.target.value }))}",
  'title input'
);

// 7. title length counter
rep(
  '                {title.length} / 80',
  '                {metadata.title.length} / 80',
  'title counter'
);

// 8. description input
rep(
  "            <input\r\n              value={description}\r\n              onChange={e => setDescription(e.target.value)}",
  "            <input\n              value={metadata.description}\n              onChange={e => setMetadata(prev => ({ ...prev, description: e.target.value }))}",
  'description input'
);

// 9. folderName input + onChange + onFocus
rep(
  "                    value={folderName}\r\n                    onChange={e => {\r\n                      setFolderName(e.target.value)\r\n                      setShowFolderDropdown(true)\r\n                    }}\r\n                    onFocus={() => setShowFolderDropdown(true)}",
  "                    value={metadata.folderName}\n                    onChange={e => setMetadata(prev => ({ ...prev, folderName: e.target.value, showFolderDropdown: true }))}\n                    onFocus={() => setMetadata(prev => ({ ...prev, showFolderDropdown: true }))}",
  'folderName input'
);

// 10. folderName truthy guard
rep(
  '                    {folderName && (',
  '                    {metadata.folderName && (',
  'folderName guard'
);

// 11. clear folder button onClick
rep(
  "                        onClick={() => {\r\n                          setFolderName('')\r\n                          setShowFolderDropdown(true)\r\n                        }}",
  "                        onClick={() => setMetadata(prev => ({ ...prev, folderName: '', showFolderDropdown: true }))}",
  'clear folder'
);

// 12. toggle dropdown
rep(
  "                      onClick={() => setShowFolderDropdown(prev => !prev)}",
  "                      onClick={() => setMetadata(prev => ({ ...prev, showFolderDropdown: !prev.showFolderDropdown }))}",
  'toggle dropdown'
);

// 13. ChevronDown rotate
rep(
  "`transform transition-transform ${showFolderDropdown ? 'rotate-180' : ''}`}",
  "`transform transition-transform ${metadata.showFolderDropdown ? 'rotate-180' : ''}`}",
  'chevrondown rotate'
);

// 14. AnimatePresence folder dropdown
rep(
  '                  {showFolderDropdown && (',
  '                  {metadata.showFolderDropdown && (',
  'AnimatePresence dropdown'
);

// 15. existingFolders.length
rep(
  '                      {existingFolders.length === 0 ? (',
  '                      {metadata.existingFolders.length === 0 ? (',
  'existingFolders length'
);

// 16. existingFolders map
rep(
  "                          {existingFolders\r\n                            .filter(f => f.toLowerCase().includes(folderName.toLowerCase()))",
  "                          {metadata.existingFolders\n                            .filter(f => f.toLowerCase().includes(metadata.folderName.toLowerCase()))",
  'existingFolders map'
);

// 17. folder item onClick
rep(
  "                                onClick={() => {\r\n                                  setFolderName(f)\r\n                                  setShowFolderDropdown(false)\r\n                                }}",
  "                                onClick={() => setMetadata(prev => ({ ...prev, folderName: f, showFolderDropdown: false }))}",
  'folder item onClick'
);

// 18. folder selected dot
rep(
  '                                {folderName.toLowerCase() === f.toLowerCase() && (',
  '                                {metadata.folderName.toLowerCase() === f.toLowerCase() && (',
  'folder selected dot'
);

// 19. empty filter count
rep(
  "                          {existingFolders.filter(f => f.toLowerCase().includes(folderName.toLowerCase())).length === 0 && (",
  "                          {metadata.existingFolders.filter(f => f.toLowerCase().includes(metadata.folderName.toLowerCase())).length === 0 && (",
  'empty filter count'
);

// 20. dismiss new folder
rep(
  "                              onClick={() => { setShowFolderDropdown(false) }}",
  "                              onClick={() => setMetadata(prev => ({ ...prev, showFolderDropdown: false }))}",
  'dismiss new folder'
);

// 21. Create "..." label
rep(
  '                                Create "{folderName}"',
  '                                Create "{metadata.folderName}"',
  'create label'
);

// 22. subject isSelected
rep(
  '                const isSelected = subject === s.value',
  '                const isSelected = metadata.subject === s.value',
  'subject isSelected'
);

// 23. subject onClick
rep(
  '                    onClick={() => setSubject(s.value)}',
  '                    onClick={() => setMetadata(prev => ({ ...prev, subject: s.value }))}',
  'subject onClick'
);

// 24. deckTags.has -> includes
rep(
  '                const isSelected = deckTags.has(tag)',
  '                const isSelected = metadata.deckTags.includes(tag)',
  'deckTags.has'
);

// 25. tag toggle onClick
rep(
  "                    onClick={() => {\r\n                      const next = new Set(deckTags)\r\n                      if (next.has(tag)) next.delete(tag)\r\n                      else next.add(tag)\r\n                      setDeckTags(next)\r\n                    }}",
  "                    onClick={() => setMetadata(prev => {\n                      const next = prev.deckTags.includes(tag) ? prev.deckTags.filter(t => t !== tag) : [...prev.deckTags, tag]\n                      return { ...prev, deckTags: next }\n                    })}",
  'tag toggle'
);

// 26. custom tags display
rep(
  '              {Array.from(deckTags).filter(t => !PREDEFINED_TAGS.includes(t)).map(tag => (',
  '              {metadata.deckTags.filter(t => !PREDEFINED_TAGS.includes(t)).map(tag => (',
  'custom tags map'
);

// 27. custom tag delete
rep(
  "                  <button onClick={() => {\r\n                    const next = new Set(deckTags)\r\n                    next.delete(tag)\r\n                    setDeckTags(next)\r\n                  }}",
  "                  <button onClick={() => setMetadata(prev => ({ ...prev, deckTags: prev.deckTags.filter(t => t !== tag) }))}",
  'custom tag delete'
);

// 28. customTagInput value
rep(
  '                value={customTagInput}',
  '                value={metadata.customTagInput}',
  'customTagInput value'
);

// 29. customTagInput onChange
rep(
  '                onChange={e => setCustomTagInput(e.target.value)}',
  '                onChange={e => setMetadata(prev => ({ ...prev, customTagInput: e.target.value }))}',
  'customTagInput onChange'
);

// 30. customTagInput onKeyDown submit
rep(
  "                    if (customTagInput.trim()) {\r\n                      setDeckTags(prev => new Set(prev).add(customTagInput.trim()));\r\n                      setCustomTagInput('');\r\n                    }",
  "                    if (metadata.customTagInput.trim()) {\n                      setMetadata(prev => ({ ...prev, deckTags: [...prev.deckTags, prev.customTagInput.trim()], customTagInput: '' }));\n                    }",
  'customTagInput onKeyDown'
);

// 31. customTagInput button click
rep(
  "                  if (customTagInput.trim()) {\r\n                    setDeckTags(prev => new Set(prev).add(customTagInput.trim()));\r\n                    setCustomTagInput('');\r\n                  }",
  "                  if (metadata.customTagInput.trim()) {\n                    setMetadata(prev => ({ ...prev, deckTags: [...prev.deckTags, prev.customTagInput.trim()], customTagInput: '' }));\n                  }",
  'customTagInput button'
);

fs.writeFileSync(file, content);
console.log('Phase 3 done');
