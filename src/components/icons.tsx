/**
 * Icon set.
 *
 * All glyphs are hand-built on a 24×24 grid with a 1.9 stroke so the UI keeps a
 * single visual rhythm across the header, composer, message actions and sheets.
 * The app's brand mark lives in `components/BrandMark.tsx` (a "DS" monogram) —
 * there is deliberately no illustrated logo.
 */

import type { ReactNode, SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number
  strokeWidth?: number
}

function Stroke({ size = 22, strokeWidth = 1.9, children, className, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ? `svg-icon ${className}` : 'svg-icon'}
      {...rest}
    >
      {children}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Navigation / chrome                                               */
/* ------------------------------------------------------------------ */

export const MenuIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h11" />
  </Stroke>
)

export const PlusIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
)

export const CloseIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Stroke>
)

export const ChevronDownIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M6 9.5l6 6 6-6" />
  </Stroke>
)

export const ChevronRightIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M9.5 6l6 6-6 6" />
  </Stroke>
)

export const ArrowUpIcon = (props: IconProps) => (
  <Stroke {...props} strokeWidth={props.strokeWidth ?? 2.2}>
    <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
  </Stroke>
)

export const StopIcon = (props: IconProps) => (
  <svg
    width={props.size ?? 22}
    height={props.size ?? 22}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className="svg-icon"
  >
    <rect x="6" y="6" width="12" height="12" rx="3" />
  </svg>
)

export const SettingsIcon = (props: IconProps) => (
  <Stroke {...props}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.66 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.54 1.7 1.7 0 0 0 10.03 3V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.1 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.46 9c.24.6.8 1.02 1.45 1.03H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
  </Stroke>
)

export const SearchIcon = (props: IconProps) => (
  <Stroke {...props}>
    <circle cx="10.8" cy="10.8" r="6.6" />
    <path d="M15.6 15.6 20.6 20.6" />
  </Stroke>
)

export const MoreIcon = (props: IconProps) => (  <Stroke {...props}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Stroke>
)

export const CheckIcon = (props: IconProps) => (
  <Stroke {...props} strokeWidth={props.strokeWidth ?? 2.3}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Stroke>
)

export const PuzzleIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M9.5 3.5a1.8 1.8 0 1 1 3.6 0V5h2.4a1.5 1.5 0 0 1 1.5 1.5v2.4h1.5a1.8 1.8 0 1 1 0 3.6H17v3.6a1.5 1.5 0 0 1-1.5 1.5h-3.4v-1.5a1.8 1.8 0 1 0-3.6 0V21H5.1a1.5 1.5 0 0 1-1.5-1.5v-3.4H5a1.8 1.8 0 1 0 0-3.6H3.6V9a1.5 1.5 0 0 1 1.5-1.5h2.4V5c0-.6.2-1.1.6-1.4Z" />
  </Stroke>
)

export const WheelIcon = (props: IconProps) => (
  <Stroke {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.2v9.6M7.2 12h9.6M12 3.5a8.5 8.5 0 0 0 0 17M3.5 12a8.5 8.5 0 0 0 17 0" />
  </Stroke>
)

/* ------------------------------------------------------------------ */
/*  Composer                                                          */
/* ------------------------------------------------------------------ */

export const SendIcon = (props: IconProps) => (
  <Stroke {...props} strokeWidth={props.strokeWidth ?? 2.1}>
    <path d="M4.4 11.4 19.6 4.6a.6.6 0 0 1 .8.79l-6.8 15.2a.6.6 0 0 1-1.1-.06l-2.1-5.9-5.9-2.1a.6.6 0 0 1-.1-1.1Z" />
  </Stroke>
)

export const MicIcon = (props: IconProps) => (
  <Stroke {...props}>
    <rect x="9" y="2.6" width="6" height="11.2" rx="3" />
    <path d="M5.4 11.4a6.6 6.6 0 0 0 13.2 0M12 18v3.4" />
  </Stroke>
)

export const KeyboardIcon = (props: IconProps) => (
  <Stroke {...props}>
    <rect x="2.4" y="6.4" width="19.2" height="11.2" rx="2.4" />
    <path d="M6.6 10.2h.01M9.9 10.2h.01M13.2 10.2h.01M16.5 10.2h.01M6.6 13.6h.01M17.4 13.6h.01M9.6 13.6h4.8" />
  </Stroke>
)

export const PaperclipIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M20 11.6l-8.3 8.3a5.2 5.2 0 0 1-7.4-7.4l8.3-8.3a3.5 3.5 0 0 1 4.9 4.9l-8.3 8.3a1.8 1.8 0 0 1-2.5-2.5l7.6-7.6" />
  </Stroke>
)

export const ImageIcon = (props: IconProps) => (
  <Stroke {...props}>
    <rect x="3" y="4.4" width="18" height="15.2" rx="2.6" />
    <circle cx="8.6" cy="9.6" r="1.5" />
    <path d="M3.4 17.2l4.6-4.4a2 2 0 0 1 2.7 0l3.2 3a2 2 0 0 0 2.7 0l3.9-3.6" />
  </Stroke>
)

export const CameraIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M3.4 8.8A2.4 2.4 0 0 1 5.8 6.4h1.3a1.6 1.6 0 0 0 1.35-.75l.62-1.05A1.6 1.6 0 0 1 10.42 3.8h3.16a1.6 1.6 0 0 1 1.35.8l.62 1.05a1.6 1.6 0 0 0 1.35.75h1.3a2.4 2.4 0 0 1 2.4 2.4v8.4a2.4 2.4 0 0 1-2.4 2.4H5.8a2.4 2.4 0 0 1-2.4-2.4Z" />
    <circle cx="12" cy="12.8" r="3.6" />
  </Stroke>
)

export const FileIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M14 2.8H7.4A2.4 2.4 0 0 0 5 5.2v13.6a2.4 2.4 0 0 0 2.4 2.4h9.2a2.4 2.4 0 0 0 2.4-2.4V7.8Z" />
    <path d="M14 2.8v5h5" />
  </Stroke>
)

export const GlobeIcon = (props: IconProps) => (
  <Stroke {...props}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M2.9 12h18.2M12 3.2c2.3 2.4 3.5 5.5 3.5 8.8s-1.2 6.4-3.5 8.8c-2.3-2.4-3.5-5.5-3.5-8.8S9.7 5.6 12 3.2Z" />
  </Stroke>
)

export const BrainIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M9.2 3.6a3 3 0 0 0-3 3v.4a3.2 3.2 0 0 0-1.4 5.5A3.2 3.2 0 0 0 6.3 18a3 3 0 0 0 2.9 2.6V3.6Z" />
    <path d="M14.8 3.6a3 3 0 0 1 3 3v.4a3.2 3.2 0 0 1 1.4 5.5A3.2 3.2 0 0 1 17.7 18a3 3 0 0 1-2.9 2.6V3.6Z" />
  </Stroke>
)

export const SparkIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M12 3.4l1.9 5.2 5.2 1.9-5.2 1.9-1.9 5.2-1.9-5.2L4.9 10.5l5.2-1.9Z" />
    <path d="M18.6 16.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8Z" opacity="0.6" />
  </Stroke>
)

/* ------------------------------------------------------------------ */
/*  Message actions                                                   */
/* ------------------------------------------------------------------ */

export const CopyIcon = (props: IconProps) => (
  <Stroke {...props}>
    <rect x="9" y="9" width="12" height="12" rx="2.6" />
    <path d="M5.6 15H5a2.4 2.4 0 0 1-2.4-2.4V5A2.4 2.4 0 0 1 5 2.6h7.6A2.4 2.4 0 0 1 15 5v.6" />
  </Stroke>
)

export const RefreshIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M20.4 12a8.4 8.4 0 1 1-2.5-5.95" />
    <path d="M20.6 3.8v4.4h-4.4" />
  </Stroke>
)

export const ThumbsUpIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M7.4 21V10.4M3.2 21h4.2M7.4 10.4l3.3-7a2.2 2.2 0 0 1 4.1 1.5l-.9 4.1h4.6a2.4 2.4 0 0 1 2.36 2.85l-1.24 6.9A2.6 2.6 0 0 1 17.06 21H7.4" />
  </Stroke>
)

export const ThumbsDownIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M16.6 3v10.6M20.8 3h-4.2M16.6 13.6l-3.3 7a2.2 2.2 0 0 1-4.1-1.5l.9-4.1H5.5a2.4 2.4 0 0 1-2.36-2.85l1.24-6.9A2.6 2.6 0 0 1 6.94 3h9.66" />
  </Stroke>
)

export const PencilIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M17.4 3.6a2.3 2.3 0 0 1 3.3 3.3L7.5 20.1l-4.4 1.1 1.1-4.4Z" />
  </Stroke>
)

export const TrashIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M3.6 6.4h16.8M8.4 6.4V4.6a1.8 1.8 0 0 1 1.8-1.8h3.6a1.8 1.8 0 0 1 1.8 1.8v1.8M5.6 6.4l.9 13a2 2 0 0 0 2 1.86h7a2 2 0 0 0 2-1.86l.9-13" />
  </Stroke>
)

export const PinIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M12 16.4V21M8.2 3.4h7.6l-1 5.2 3 3.4H6.2l3-3.4Z" />
  </Stroke>
)

export const ExternalLinkIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M13.6 4.4h6v6M19.6 4.4l-8 8" />
    <path d="M18.4 14.2v4.4a2.4 2.4 0 0 1-2.4 2.4H5.8a2.4 2.4 0 0 1-2.4-2.4V8.4A2.4 2.4 0 0 1 5.8 6h4.4" />
  </Stroke>
)

export const AlertIcon = (props: IconProps) => (
  <Stroke {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.4v5.4M12 16.4h.01" />
  </Stroke>
)

export const InfoIcon = (props: IconProps) => (
  <Stroke {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.6h.01" />
  </Stroke>
)

export const BookOpenIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M12 6.6C10.4 5.2 8.2 4.4 5.4 4.4c-.9 0-1.6.1-2.2.3v13.6c.6-.2 1.3-.3 2.2-.3 2.8 0 5 .8 6.6 2.2 1.6-1.4 3.8-2.2 6.6-2.2.9 0 1.6.1 2.2.3V4.7c-.6-.2-1.3-.3-2.2-.3-2.8 0-5 .8-6.6 2.2Z" />
    <path d="M12 6.6v13.6" />
  </Stroke>
)

export const ArrowLeftIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M19.5 12H5" />
    <path d="M11 5.5 4.5 12l6.5 6.5" />
  </Stroke>
)

export const CodeIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M8.8 7.6 4.4 12l4.4 4.4" />
    <path d="M15.2 7.6 19.6 12l-4.4 4.4" />
    <path d="M13.3 5.6l-2.6 12.8" />
  </Stroke>
)

/** Expand outward — used by the composer's full-screen editor. */
export const ExpandIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M14.2 4.6h5.2v5.2" />
    <path d="M19.4 4.6 13.6 10.4" />
    <path d="M9.8 19.4H4.6v-5.2" />
    <path d="M4.6 19.4l5.8-5.8" />
  </Stroke>
)

/** Collapse back inward. */
export const CollapseIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M19.4 9.8h-5.2V4.6" />
    <path d="M14.2 9.8 20 4" />
    <path d="M4.6 14.2h5.2v5.2" />
    <path d="M9.8 14.2 4 20" />
  </Stroke>
)

export const ClockIcon = (props: IconProps) => (
  <Stroke {...props}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M12 7.4V12l3.2 2" />
  </Stroke>
)

export const KeyIcon = (props: IconProps) => (
  <Stroke {...props}>
    <circle cx="8" cy="15.6" r="4.4" />
    <path d="M11.2 12.4 20 3.6M16.4 7.2l2.4 2.4M14 9.6l2.4 2.4" />
  </Stroke>
)

export const SunIcon = (props: IconProps) => (
  <Stroke {...props}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6 6 18M18 6l1.6-1.6" />
  </Stroke>
)

export const MoonIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M20.2 14.4A8.6 8.6 0 0 1 9.6 3.8a8.6 8.6 0 1 0 10.6 10.6Z" />
  </Stroke>
)

export const AutoThemeIcon = (props: IconProps) => (
  <Stroke {...props}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M12 3.2v17.6A8.8 8.8 0 0 0 12 3.2Z" fill="currentColor" stroke="none" />
  </Stroke>
)

export const EditIcon = PencilIcon
export const StopCircleIcon = StopIcon
export const UndoIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M4 9.4h10.4a5.2 5.2 0 0 1 0 10.4H8.2" />
    <path d="M7.8 5.2 3.6 9.4l4.2 4.2" />
  </Stroke>
)

export const CloudOffIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M4.6 4.6 19.4 19.4" />
    <path d="M7.9 7.6A4.4 4.4 0 0 1 15.6 9a4.8 4.8 0 0 1 4.5 6.9" />
    <path d="M6.8 8.6A4.9 4.9 0 0 0 8.4 18h8" />
  </Stroke>
)

export const LayersIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M12 3.2 3.4 8l8.6 4.8L20.6 8Z" />
    <path d="M3.4 12.6 12 17.4l8.6-4.8M3.4 17.2 12 22l8.6-4.8" />
  </Stroke>
)
