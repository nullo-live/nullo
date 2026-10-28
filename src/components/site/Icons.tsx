/* Small stroke icons drawn for this site. */

type P = { size?: number; className?: string };

function Svg({ size = 16, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export const ArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Svg>
);
export const ArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M20 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const ArrowUpRight = (p: P) => (
  <Svg {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="m5 12 5 5 9-10" />
  </Svg>
);
export const CloseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const CopyIcon = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
  </Svg>
);
export const PlayIcon = (p: P) => (
  <Svg {...p}>
    <path d="M7 5v14l12-7z" />
  </Svg>
);
export const LogOutIcon = (p: P) => (
  <Svg {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
  </Svg>
);
export const RefreshIcon = (p: P) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
  </Svg>
);
export const WalletIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <path d="M16 12.5h2M3 9h15a3 3 0 0 0-3-3" />
  </Svg>
);
export const XLogo = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.9 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
  </svg>
);

export const ArrowDown = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v15M6 13l6 6 6-6" />
  </Svg>
);
export const PauseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 5v14M15 5v14" />
  </Svg>
);
export const MenuIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 8h16M4 16h16" />
  </Svg>
);
export const CompassIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </Svg>
);
export const PuzzleIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 4h4a2 2 0 1 1 3 2v3h3a2 2 0 1 1 0 4h0v5a2 2 0 0 1-2 2h-4a2 2 0 1 0-4 0H5a2 2 0 0 1-2-2v-4a2 2 0 1 0 0-4V6a2 2 0 0 1 2-2z" />
  </Svg>
);
export const BookIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
    <path d="M5 17a3 3 0 0 1 3-3h11M9 8h6" />
  </Svg>
);
export const GemIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 4h12l3 5-9 11L3 9z" />
    <path d="M3 9h18M9 4l3 16 3-16" />
  </Svg>
);
export const UserIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="9" r="4" />
    <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Svg>
);
export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Svg>
);
export const ShieldIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
export const StampIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 4h6v5l2 3H7l2-3zM5 15h14v3H5zM7 21h10" />
  </Svg>
);
export const DocIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4M9 12h6M9 16h6" />
  </Svg>
);
export const HelpIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5M12 17h.01" />
  </Svg>
);
export const HistoryIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5M12 8v4l3 2" />
  </Svg>
);
export const LockIcon = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Svg>
);
export const LensIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="6" />
    <circle cx="10" cy="10" r="2" />
    <path d="m14.5 14.5 5 5" />
  </Svg>
);
export const LeafIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7" />
  </Svg>
);
export const DownloadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Svg>
);
export const ChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const StarIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />
  </Svg>
);
export const ForkIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="5" r="2" />
    <circle cx="18" cy="5" r="2" />
    <circle cx="12" cy="19" r="2" />
    <path d="M6 7v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7M12 12v5" />
  </Svg>
);
export const CommitIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M2 12h6.5M15.5 12H22" />
  </Svg>
);
export const PullIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="5" r="2" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="19" r="2" />
    <path d="M6 7v10M18 17V9a3 3 0 0 0-3-3h-4M13 3.5L10.5 6 13 8.5" />
  </Svg>
);
export const IssueIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="1.5" />
  </Svg>
);
export const UsersIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5M16 5.2a3 3 0 0 1 0 5.6M18 14c1.7.6 2.8 2.2 3 5" />
  </Svg>
);
export const GitHubLogo = ({ size = 16, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-1.9c-3.12.68-3.78-1.5-3.78-1.5-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.49-.28-5.11-1.25-5.11-5.55 0-1.22.44-2.23 1.16-3.01-.12-.29-.5-1.43.11-2.97 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.97.72.78 1.16 1.79 1.16 3.01 0 4.31-2.63 5.26-5.13 5.54.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8z" />
  </svg>
);
export const NodesIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="8" r="2.5" />
    <circle cx="10" cy="18" r="2.5" />
    <path d="M8.3 7l7.3.8M7 8.3l2.2 7.3M16.6 10l-4.9 6.1" />
  </Svg>
);
export const LinkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const LayersIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </Svg>
);
export const SparkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
  </Svg>
);
export const BranchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="5" r="2" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="9" r="2" />
    <path d="M6 7v10M18 11c0 4-6 3-11.5 6.5" />
  </Svg>
);
export const PrintIcon = (p: P) => (
  <Svg {...p}>
    <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" />
  </Svg>
);
export const BracesIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 3c-2 0-3 1-3 3v3c0 1.5-1 2.5-2 3 1 .5 2 1.5 2 3v3c0 2 1 3 3 3M16 3c2 0 3 1 3 3v3c0 1.5 1 2.5 2 3-1 .5-2 1.5-2 3v3c0 2-1 3-3 3" />
  </Svg>
);
export const PlusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const MinusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const TrashIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
);
export const UploadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 15V4M7 9l5-5 5 5M5 20h14" />
  </Svg>
);
export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);
export const KeyIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2" />
  </Svg>
);
export const TagIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
    <circle cx="8" cy="8" r="1.5" />
  </Svg>
);
export const FlagIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Svg>
);
export const ScanIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" />
  </Svg>
);
export const BanIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </Svg>
);
