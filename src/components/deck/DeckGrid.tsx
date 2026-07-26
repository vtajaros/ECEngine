import React from 'react'

export function DeckGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 @[1080px]:grid-cols-2 gap-12 pt-0 pb-4">
        {children}
      </div>
    </div>
  )
}
