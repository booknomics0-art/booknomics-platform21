// Centralized social media configuration for Booknomics.
// Reused across Header, Footer, Homepage section, and SEO (sameAs).

export type SocialPlatform =
  | "instagram"
  | "threads"
  | "facebook"
  | "youtube-hindi"
  | "youtube-english"
  | "pinterest";

export interface SocialLink {
  platform: SocialPlatform;
  name: string;
  url: string;
  description: string;
  category: "social" | "video" | "visual";
  ariaLabel: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    platform: "instagram",
    name: "Instagram",
    url: "https://www.instagram.com/booknomics_official/",
    description: "Reels, quotes & updates",
    category: "social",
    ariaLabel: "Follow Booknomics on Instagram",
  },
  {
    platform: "threads",
    name: "Threads",
    url: "https://www.threads.com/@booknomics_official",
    description: "Quick thoughts & conversations",
    category: "social",
    ariaLabel: "Follow Booknomics on Threads",
  },
  {
    platform: "facebook",
    name: "Facebook",
    url: "https://www.facebook.com/profile.php?id=61590907565450",
    description: "Community updates",
    category: "social",
    ariaLabel: "Follow Booknomics on Facebook",
  },
  {
    platform: "youtube-hindi",
    name: "YouTube Hindi",
    url: "https://www.youtube.com/@booknomics_hindi",
    description: "Hindi book summaries",
    category: "video",
    ariaLabel: "Subscribe to Booknomics Hindi on YouTube",
  },
  {
    platform: "youtube-english",
    name: "YouTube English",
    url: "https://www.youtube.com/@BookNomicsOfficial",
    description: "English videos & insights",
    category: "video",
    ariaLabel: "Subscribe to Booknomics English on YouTube",
  },
  {
    platform: "pinterest",
    name: "Pinterest",
    url: "https://in.pinterest.com/booknomics_official/",
    description: "Infographics & visual ideas",
    category: "visual",
    ariaLabel: "Follow Booknomics on Pinterest",
  },
];

/**
 * rel value for outbound social links: keeps them useful for readers while
 * avoiding unnecessary authority leakage to third-party profiles.
 */
export const SOCIAL_REL = "nofollow noopener noreferrer";

export type SocialPlacement =
  | "footer_social"
  | "homepage_social_section"
  | "header_follow_dropdown"
  | "mobile_menu_social";

/** Append UTM tracking params without mutating original URL string. */
export const withUtm = (url: string, placement: SocialPlacement): string => {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "website");
    u.searchParams.set("utm_medium", "social_link");
    u.searchParams.set("utm_campaign", "booknomics_social_follow");
    u.searchParams.set("utm_content", placement);
    return u.toString();
  } catch {
    return url;
  }
};

/** Absolute URLs (no UTM) for SEO sameAs JSON-LD. */
export const socialSameAs = (): string[] => SOCIAL_LINKS.map((s) => s.url);
