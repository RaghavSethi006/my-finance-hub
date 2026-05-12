import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  glyphClassName?: string;
};

export function BrandMark({ className, glyphClassName }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary via-sky-500 to-emerald-400 shadow-lg shadow-primary/20",
        className
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        className={cn("h-3/5 w-3/5 text-white drop-shadow-sm", glyphClassName)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M32 9 49 16.5V30.5C49 42 42.2 50.8 32 55 21.8 50.8 15 42 15 30.5V16.5L32 9Z"
          stroke="currentColor"
          strokeWidth="4.6"
          strokeLinejoin="round"
        />
        <path
          d="M22 38.5 29 31.5 35 36.5 44 24.5"
          stroke="currentColor"
          strokeWidth="4.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M23 22.5H41" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-x-2 top-1 h-px bg-white/45" />
    </div>
  );
}
