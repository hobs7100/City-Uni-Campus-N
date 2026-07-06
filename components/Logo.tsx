import Image from "next/image";

const SIZES = {
  sm: { width: 132, height: 38 },
  md: { width: 168, height: 48 },
  lg: { width: 240, height: 68 },
} as const;

export default function Logo({
  size = "md",
  className = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { width, height } = SIZES[size];
  return (
    <div
      className={`inline-flex shrink-0 items-center rounded-lg bg-white px-2 py-1 shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${className}`}
    >
      <Image
        src="/images/logo.png"
        alt="City College — University Campus"
        width={width}
        height={height}
        priority
        className="object-contain"
        style={{ height: "auto", width: "auto", maxHeight: height, maxWidth: width }}
      />
    </div>
  );
}
