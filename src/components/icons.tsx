/** Small stroke icons, inline so the app ships no icon dependency. */
type Props = { className?: string }

const base = 'h-6 w-6'

const Svg = ({ children, className }: Props & { children: React.ReactNode }) => (
  <svg
    className={className ?? base}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const HomeIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
  </Svg>
)

export const SearchIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Svg>
)

export const DeckIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="7" y="4" width="11" height="15" rx="2" />
    <path d="M5 7v12a2 2 0 0 0 2 2h8" />
  </Svg>
)

export const FriendsIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="3.2" />
    <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S14 16 14.6 19" />
    <path d="M16 6.5a3 3 0 0 1 0 5.6M18 19c-.2-1.4-.7-2.6-1.5-3.5" />
  </Svg>
)

export const SparkleIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9Z" />
    <path d="M18.5 16.5 19 18.4l1.9.6-1.9.6-.5 1.9-.6-1.9-1.9-.6 1.9-.6Z" />
  </Svg>
)

export const StarIcon = ({ filled, className }: Props & { filled?: boolean }) => (
  <svg
    className={className ?? 'h-5 w-5'}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.6"
    aria-hidden="true"
  >
    <path d="m12 3.8 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8Z" />
  </svg>
)
