import { StarIcon } from './icons'

/**
 * The star sits in the top-right corner of a card, over a link. It has to
 * swallow the click, or tapping it would navigate instead of favouriting.
 */
export function FavoriteStar({
  on,
  onToggle,
  label,
}: {
  on: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
      className="absolute top-1.5 right-1.5 z-10 rounded-full p-2 text-muted transition-colors hover:bg-surface-2 aria-pressed:text-suit-gold"
    >
      <StarIcon filled={on} className="h-5 w-5" />
    </button>
  )
}
