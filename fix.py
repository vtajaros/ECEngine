import re

with open('src/pages/FlashcardStudy.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

new_text = re.sub(
    r"const flashcards = rawCards\.filter\(\(r: any\) => r\.type !== 'mcq'\)\.map\(\(r: any\) => \(\{ \.\.\.r\.data, id: r\.id \}\)\)",
    """const flashcards = rawCards.filter((r: any) => r.type !== 'mcq').map((r: any) => {
          if (r.type === 'formula') {
            const f = r.data
            return {
              id: r.id,
              front: f.name + (f.latex ? `\\n\\n$$` + f.latex + `$$` : ''),
              back: [f.description, f.variables].filter(Boolean).join('\\n\\n')
            }
          }
          return { ...r.data, id: r.id }
        })""",
    text
)

with open('src/pages/FlashcardStudy.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)