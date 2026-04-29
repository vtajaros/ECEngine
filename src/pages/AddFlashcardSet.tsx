import React, { useState, useEffect } from 'react'
import { DownloadCloud, FileText, Type, CheckCircle, Database } from 'lucide-react'
import { parseQuizletText, parseSmartMCQ, parseQuizletMCQ } from '../lib/parser'

type ImportMode = 'json' | 'flashcards' | 'mcq'

export default function ImportContent() {
  const [mode, setMode] = useState<ImportMode>('flashcards')
  const [inputText, setInputText] = useState('')
  const [termDelim, setTermDelim] = useState('custom')
  const [cardDelim, setCardDelim] = useState('custom')
  const [customTermDelim, setCustomTermDelim] = useState(':')
  const [customCardDelim, setCustomCardDelim] = useState('\\n\\n')
  const [quizletIsMCQ, setQuizletIsMCQ] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])

  // Modal State
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [deckName, setDeckName] = useState('')
  const [deckSubject, setDeckSubject] = useState('Electronics Engineering')

  useEffect(() => {
    if (!inputText) {
      setPreviewData([])
      return
    }

    const activeTermDelim = termDelim === 'custom' ? customTermDelim : termDelim
    const activeCardDelim = cardDelim === 'custom' ? customCardDelim : cardDelim

    if (mode === 'flashcards') {
      if (!activeTermDelim || !activeCardDelim) {
        setPreviewData([])
        return
      }
      if (quizletIsMCQ) {
        const parsed = parseQuizletMCQ(inputText, activeTermDelim, activeCardDelim)
        setPreviewData(parsed)
      } else {
        const parsed = parseQuizletText(inputText, activeTermDelim, activeCardDelim)
        setPreviewData(parsed)
      }
    } else if (mode === 'mcq') {
      const parsed = parseSmartMCQ(inputText)
      setPreviewData(parsed)
    }
  }, [inputText, mode, termDelim, cardDelim, customTermDelim, customCardDelim, quizletIsMCQ])

  const handleImport = () => {
    if (previewData.length === 0) return
    setShowSaveModal(true)
  }

  const confirmImport = async () => {
    if (!deckName.trim()) {
      alert("Please provide a deck name.")
      return
    }

    try {
      const topicId = 'topic_' + Date.now().toString(36)
      
      // 1. Insert the new Deck (Topic)
      await window.electron.db.run(
        `INSERT INTO topics (id, name, subject) VALUES (?, ?, ?)`,
        [topicId, deckName, deckSubject]
      )

      // 2. Insert all Cards sequentially
      for (const item of previewData) {
        const cardId = 'card_' + Math.random().toString(36).substr(2, 9)
        const type = (mode === 'mcq' || quizletIsMCQ) ? 'mcq' : 'flashcard'
        
        await window.electron.db.run(
          `INSERT INTO cards (id, topic_id, type, data, is_custom) VALUES (?, ?, ?, ?, ?)`,
          [cardId, topicId, type, JSON.stringify(item), 1]
        )
      }

      alert(`Successfully imported ${previewData.length} items to ${deckName}!`)
      setShowSaveModal(false)
      setInputText('')
      setDeckName('')
    } catch (err: any) {
      console.error('Import failed', err)
      alert("Failed to import data: " + err.message)
    }
  }

  return (
    <div className="h-full bg-[#0D0D0D] p-8 lg:p-12 overflow-y-auto flex flex-col w-full relative">
      <header className="mb-10">
        <h1 className="font-['Orbitron'] text-4xl font-bold text-[#E8E8E8] tracking-wider flex items-center">
          <DownloadCloud className="text-[#00FF41] mr-4" size={36} />
          IMPORT DATA
        </h1>
        <p className="text-[#888888] font-['Rajdhani'] text-lg uppercase tracking-widest mt-2">
          Load new decks, formulas, and mock exams
        </p>
      </header>

      {/* Save Modal Popup */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#333] rounded-lg p-8 max-w-md w-full shadow-2xl flex flex-col gap-6">
            <h2 className="text-2xl font-bold text-[#00FF41] font-['Orbitron'] uppercase tracking-wider">
              Save Deck
            </h2>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-['Rajdhani'] uppercase text-[#888888] tracking-widest">Deck Name</label>
              <input 
                type="text" 
                value={deckName}
                onChange={e => setDeckName(e.target.value)}
                placeholder="e.g. Chapter 4: Resonance..."
                className="w-full bg-[#161616] text-[#E8E8E8] border border-[#333] focus:border-[#00FF41] p-3 rounded focus:outline-none font-['IBM_Plex_Mono'] text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-['Rajdhani'] uppercase text-[#888888] tracking-widest">Subject Category</label>
              <select 
                value={deckSubject}
                onChange={e => setDeckSubject(e.target.value)}
                className="w-full bg-[#161616] text-[#E8E8E8] border border-[#333] p-3 rounded focus:outline-none font-['IBM_Plex_Mono'] text-sm"
              >
                <option value="Mathematics">Mathematics</option>
                <option value="General Engineering & Applied Sciences">General Engineering & Applied Sciences</option>
                <option value="Electronics Engineering">Electronics Engineering</option>
                <option value="Electronics Systems & Technologies">Electronics Systems & Technologies (Communications)</option>
              </select>
            </div>
            <div className="flex gap-4 mt-2">
              <button 
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-3 bg-[#161616] text-[#888] rounded border border-[#333] hover:text-[#E8E8E8] hover:border-[#555] transition-colors font-['Rajdhani'] uppercase tracking-widest text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={confirmImport}
                className="flex-1 py-3 bg-[#00FF41] text-[#0D0D0D] rounded border border-[#00FF41] hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all font-['Rajdhani'] uppercase font-bold tracking-widest text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#222] mb-8">
        <button
          onClick={() => setMode('flashcards')}
          className={`px-6 py-4 flex items-center font-['Rajdhani'] uppercase tracking-wider text-sm transition-colors ${
            mode === 'flashcards' 
              ? 'text-[#00FF41] border-b-2 border-[#00FF41] bg-[rgba(0,255,65,0.05)]' 
              : 'text-[#888888] hover:text-[#E8E8E8] hover:bg-[#111]'
          }`}
        >
          <Type size={18} className="mr-2" /> Flashcards (Quizlet)
        </button>
        <button
          onClick={() => setMode('mcq')}
          className={`px-6 py-4 flex items-center font-['Rajdhani'] uppercase tracking-wider text-sm transition-colors ${
            mode === 'mcq' 
              ? 'text-[#00FF41] border-b-2 border-[#00FF41] bg-[rgba(0,255,65,0.05)]' 
              : 'text-[#888888] hover:text-[#E8E8E8] hover:bg-[#111]'
          }`}
        >
          <FileText size={18} className="mr-2" /> PDF / Web MCQs
        </button>
        <button
          onClick={() => setMode('json')}
          className={`px-6 py-4 flex items-center font-['Rajdhani'] uppercase tracking-wider text-sm transition-colors ${
            mode === 'json' 
              ? 'text-[#00FF41] border-b-2 border-[#00FF41] bg-[rgba(0,255,65,0.05)]' 
              : 'text-[#888888] hover:text-[#E8E8E8] hover:bg-[#111]'
          }`}
        >
          <Database size={18} className="mr-2" /> JSON Database
        </button>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row gap-8 min-h-0 pb-10">
        {/* Left Column: Input Form */}
        <div className="flex-1 flex flex-col min-h-[500px]">
          {mode === 'json' ? (
            <div className="flex-1 border-2 border-dashed border-[#222] rounded-xl p-16 text-center hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.02)] transition-all flex flex-col items-center justify-center cursor-pointer group">
               <div className="mb-6 p-6 rounded-full bg-[#111111] border border-[#161616] group-hover:border-[#00FF41] group-hover:text-[#00FF41] group-hover:shadow-[0_0_20px_rgba(0,255,65,0.2)] transition-all">
                 <DownloadCloud className="w-12 h-12 text-[#888888] group-hover:text-[#00FF41]" />
               </div>
               <h2 className="font-['Rajdhani'] text-2xl font-bold text-[#E8E8E8] mb-2 uppercase tracking-wide">
                 Drag & Drop JSON File
               </h2>
               <p className="text-[#555] font-['IBM_Plex_Mono'] text-sm mb-8">
                 Supports ECEngine .json format only
               </p>
               <button className="px-6 py-3 bg-[#111111] text-[#00FF41] border border-[#00FF41] rounded font-['Rajdhani'] uppercase tracking-widest hover:bg-[rgba(0,255,65,0.1)] transition-colors focus:shadow-[0_0_10px_rgba(0,255,65,0.4)]">
                 Browse Files
               </button>
            </div>
          ) : (
            <div className="flex flex-col h-full gap-4">
              <div className="bg-[#161616] rounded-lg border border-[#222] flex-1 flex flex-col overflow-hidden">
                <div className="p-4 bg-[#111] border-b border-[#222] flex justify-between items-center">
                  <span className="font-['Rajdhani'] text-[#888888] uppercase tracking-wider text-sm">
                    {mode === 'mcq' ? "Paste RAW questions text (includes A. B. C. D. logic)" : "Paste your Word, Excel, or Web format"}
                  </span>
                </div>
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={mode === 'flashcards' 
                    ? "Voltage - V\\nCurrent - I\\nResistance - R" 
                    : "1. What is Ohm's Law?\\nA. V=IR\\nB. P=IV\\nC. V=PR\\nD. I=VR\\nAnswer: A"}
                  className="flex-1 w-full bg-transparent text-[#E8E8E8] p-6 focus:outline-none resize-none font-['IBM_Plex_Mono'] text-sm leading-relaxed"
                />
              </div>

              {mode === 'flashcards' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 bg-[#111111] p-4 rounded-lg border border-[#222]">
                    <label className="block text-xs font-['Rajdhani'] uppercase text-[#888888] tracking-widest">Import Target Type</label>
                    <div className="flex gap-2">
                        <button 
                          onClick={() => setQuizletIsMCQ(false)}
                          className={`flex-1 py-2 text-sm font-['Rajdhani'] uppercase tracking-wider rounded border transition-colors ${!quizletIsMCQ ? 'bg-[rgba(0,255,65,0.1)] border-[#00FF41] text-[#00FF41]' : 'border-[#222] text-[#888] hover:border-[#444]'}`}
                        >
                          Flashcard Deck
                        </button>
                        <button 
                          onClick={() => setQuizletIsMCQ(true)}
                          className={`flex-1 py-2 text-sm font-['Rajdhani'] uppercase tracking-wider rounded border transition-colors ${quizletIsMCQ ? 'bg-[rgba(0,255,65,0.1)] border-[#00FF41] text-[#00FF41]' : 'border-[#222] text-[#888] hover:border-[#444]'}`}
                        >
                          MCQ Deck
                        </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 bg-[#111111] p-4 rounded-lg border border-[#222]">
                    <div className="flex flex-col gap-2">
                      <label className="block text-xs font-['Rajdhani'] uppercase text-[#888888] tracking-widest">Between Term & Def</label>
                      <select value={termDelim} onChange={e => setTermDelim(e.target.value)} className="w-full bg-[#161616] text-[#E8E8E8] border border-[#333] p-2 rounded focus:outline-none font-['IBM_Plex_Mono'] text-sm">
                        <option value="-">Dash (-)</option>
                        <option value="\t">Tab</option>
                        <option value=",">Comma</option>
                        <option value=";">Semicolon</option>
                        <option value="custom">Custom...</option>
                      </select>
                      {termDelim === 'custom' && (
                        <input 
                          type="text" 
                          value={customTermDelim} 
                          onChange={e => setCustomTermDelim(e.target.value)} 
                          placeholder="Custom separator..." 
                          className="w-full bg-[#161616] text-[#E8E8E8] border border-[#333] focus:border-[#00FF41] p-2 rounded focus:outline-none font-['IBM_Plex_Mono'] text-sm transition-colors"
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="block text-xs font-['Rajdhani'] uppercase text-[#888888] tracking-widest">Between Cards</label>
                      <select value={cardDelim} onChange={e => setCardDelim(e.target.value)} className="w-full bg-[#161616] text-[#E8E8E8] border border-[#333] p-2 rounded focus:outline-none font-['IBM_Plex_Mono'] text-sm">
                        <option value="\n">New Line</option>
                        <option value="\n\n">Double New Line</option>
                        <option value=";">Semicolon</option>
                        <option value="custom">Custom...</option>
                      </select>
                      {cardDelim === 'custom' && (
                        <input 
                          type="text" 
                          value={customCardDelim} 
                          onChange={e => setCustomCardDelim(e.target.value)} 
                          placeholder="Custom separator..." 
                          className="w-full bg-[#161616] text-[#E8E8E8] border border-[#333] focus:border-[#00FF41] p-2 rounded focus:outline-none font-['IBM_Plex_Mono'] text-sm transition-colors"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button 
                onClick={handleImport}
                disabled={previewData.length === 0}
                className="w-full py-4 mt-2 bg-[#00FF41] text-[#0D0D0D] rounded font-['Orbitron'] font-bold tracking-widest uppercase transition-all hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_15px_rgba(0,255,65,0.3)] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex justify-center items-center"
              >
                <CheckCircle className="mr-2" /> Convert & Load {previewData.length} Items
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Preview Display */}
        {mode !== 'json' && (
          <div className="flex-1 bg-[#161616] rounded-lg border border-[#222] flex flex-col max-h-[800px] overflow-hidden shadow-2xl">
            <div className="p-4 bg-[#111] border-b border-[#222] flex justify-between items-center z-10 shrink-0">
               <h3 className="font-['Rajdhani'] text-[#A0A0A0] uppercase tracking-wider font-bold">
                 Preview ({previewData.length})
               </h3>
               {previewData.length > 0 && <span className="text-[#00FF41] text-xs font-['IBM_Plex_Mono']">Parse Success</span>}
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               {previewData.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-[#555]">
                   <Type size={48} className="mb-4 opacity-50" />
                   <p className="font-['IBM_Plex_Mono'] text-sm text-center max-w-sm">
                     Nothing to preview yet. Paste your raw data on the left panel to begin parsing.
                   </p>
                 </div>
               ) : (
                 previewData.map((item, idx) => (
                   <div key={idx} className="bg-[#0D0D0D] p-5 rounded border border-[#222] relative group">
                     <div className="absolute top-2 right-2 text-xs font-['IBM_Plex_Mono'] text-[#555]">#{idx + 1}</div>
                     {mode === 'flashcards' && !quizletIsMCQ ? (
                       <div className="flex flex-col gap-2">
                         <div>
                           <span className="text-xs font-['Rajdhani'] uppercase text-[#00FF41] tracking-widest block mb-1">Front</span>
                           <div className="text-[#E8E8E8]">{item.front || item.question}</div>
                         </div>
                         <div className="border-t border-[#222] pt-2 mt-1">
                           <span className="text-xs font-['Rajdhani'] uppercase text-[#00BFFF] tracking-widest block mb-1">Back</span>
                           <div className="text-[#A0A0A0]">{item.back || (item.choices && item.choices[item.answer])}</div>
                         </div>
                       </div>
                     ) : (
                       <div className="flex flex-col gap-3">
                         <div className="text-[#E8E8E8] font-medium border-b border-[#222] pb-3 mb-1">
                           {item.question || item.front}
                         </div>
                         <div className="grid grid-cols-1 gap-2">
                           {(item.choices || []).map((c: string, ci: number) => (
                             <div key={ci} className={`text-sm p-2 rounded border ${item.answer === ci ? 'border-[#00FF41] text-[#00FF41] bg-[rgba(0,255,65,0.05)]' : 'border-[#222] text-[#888]'}`}>
                               {String.fromCharCode(65 + ci)}. {c}
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 ))

               )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
