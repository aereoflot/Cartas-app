import type { ReactNode } from 'react'

/**
 * Rules bodies use a deliberately tiny subset of Markdown: blank-line
 * paragraphs, "- " lists and **bold**. Rendering it by hand keeps a parser (and
 * an HTML-injection surface) out of the app — the editor allows nothing else.
 */

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  )
}

export function Markdown({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/)

  return (
    <div className="space-y-3 text-[0.95rem] leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        if (lines.every((l) => l.trimStart().startsWith('- '))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.trimStart().slice(2))}</li>
              ))}
            </ul>
          )
        }
        return <p key={i}>{inline(block)}</p>
      })}
    </div>
  )
}
