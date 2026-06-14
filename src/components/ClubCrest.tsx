// Klubbmärket (BK Zeros) som återanvändbar bild. Storlek styrs via className
// från anropsstället (t.ex. "h-12 w-auto"). Utan alt-text behandlas märket
// som dekorativt och döljs för skärmläsare.

import Image from "next/image";

export default function ClubCrest({
  className,
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src="/bk-zeros.svg"
      alt={alt}
      width={938}
      height={563}
      className={className}
      // SVG:n optimeras inte av Next utan serveras som den är
      unoptimized
      aria-hidden={alt === "" ? true : undefined}
    />
  );
}
