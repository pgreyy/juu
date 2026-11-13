export function StackMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={"juu-mark " + className} style={{ width: size, height: size }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="17" width="18" height="4" />
        <rect x="6" y="11" width="12" height="4" />
        <rect x="9" y="5" width="6" height="4" />
      </svg>
    </span>
  );
}
