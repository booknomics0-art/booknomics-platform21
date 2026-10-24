type BrandLogoProps = {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
};

/** The same Booknomics emblem and wordmark used for favicons and social previews. */
export const BrandLogo = ({
  className = "",
  iconClassName = "h-10 w-10",
  wordmarkClassName = "w-[140px] sm:w-[168px]",
}: BrandLogoProps) => (
  <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
    <img
      src="/booknomics-icon-512.png"
      alt=""
      aria-hidden="true"
      width={512}
      height={512}
      className={`${iconClassName} shrink-0 rounded-xl bg-[#fdfbf6] object-contain`}
    />
    <img
      src="/booknomics-wordmark.png"
      alt="Booknomics — Read · Apply · Transform"
      width={960}
      height={218}
      className={`${wordmarkClassName} h-auto min-w-0 rounded-sm bg-[#fdfbf6] object-contain`}
    />
  </span>
);
