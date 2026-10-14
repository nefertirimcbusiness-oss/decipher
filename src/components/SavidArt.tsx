type Variant = "hero" | "header" | "logo" | "legal" | "avatar" | "badge" | "inline";

const SRC: Record<Variant, string> = {
  hero: "/savid-subscribe.png",
  header: "/savid-subscribe.png",
  logo: "/savid-subscribe.png",
  legal: "/safe-space.png",
  avatar: "/savid-welcoming.png",
  badge: "/savid-welcoming.png",
  inline: "/savid-welcoming.png",
};

const CLS: Record<Variant, string> = {
  hero: "h-28 w-28 object-contain",
  header: "h-16 w-16 object-contain",
  logo: "h-16 w-16 object-contain",
  legal: "h-20 w-20 object-contain",
  avatar: "h-full w-full object-cover",
  badge: "h-5 w-5 object-cover rounded-full",
  inline: "h-6 w-6 object-contain inline-block align-middle",
};

export function SavidArt({
  variant = "header",
  alt = "Savid, your owl mentor",
  className = "",
}: {
  variant?: Variant;
  alt?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[variant]}
      alt={alt}
      aria-hidden={variant === "badge" || variant === "inline" ? "true" : undefined}
      className={`${CLS[variant]} ${className}`}
    />
  );
}
