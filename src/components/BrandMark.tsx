/**
 * BrandMark — the "DS" wordmark chip.
 *
 * The app carries no illustrated logo; wherever a brand mark is needed (drawer
 * header, onboarding) it is this two-letter monogram, which matches the launcher
 * icon and keeps the identity purely typographic.
 */

interface BrandMarkProps {
  size?: number
  className?: string
}

export function BrandMark({ size = 28, className }: BrandMarkProps) {
  return (
    <span
      className={className ? `brand-mark ${className}` : 'brand-mark'}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      DS
    </span>
  )
}
