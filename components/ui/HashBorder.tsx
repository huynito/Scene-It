const HASH_CHARS = "#".repeat(300);

export const HASH_BORDER_H = 16;
export const HASH_BORDER_W = 10;

interface HashBorderProps {
  direction: "horizontal" | "vertical";
  className?: string;
}

export default function HashBorder({ direction, className = "" }: HashBorderProps) {
  if (direction === "horizontal") {
    return (
      <div
        className={`hash-border hash-border-h shrink-0 overflow-hidden whitespace-nowrap ${className}`}
        style={{
          height: HASH_BORDER_H,
          lineHeight: `${HASH_BORDER_H}px`,
          userSelect: "none",
        }}
        aria-hidden
      >
        {HASH_CHARS}
      </div>
    );
  }

  return (
    <div
      className={`hash-border hash-border-v shrink-0 overflow-hidden ${className}`}
      style={{
        width: HASH_BORDER_W,
        lineHeight: `${HASH_BORDER_H}px`,
        wordBreak: "break-all",
        userSelect: "none",
      }}
      aria-hidden
    >
      {HASH_CHARS}
    </div>
  );
}
