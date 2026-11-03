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

/**
 * Business registry profiles (e.g. Crunchbase) that verify Booknomics' identity
 * for Google's Knowledge Graph via Organization `sameAs`. Kept separate from
 * SOCIAL_LINKS because these are not "follow us" destinations: their links must
 * stay dofollow and UTM-free so search engines can connect the website to the
 * profile cleanly.
 */
export interface BusinessProfile {
  name: string;
  url: string;
  ariaLabel: string;
}

export const CRUNCHBASE_URL = "https://www.crunchbase.com/organization/booknomics";

export const BUSINESS_PROFILES: BusinessProfile[] = [
  {
    name: "Crunchbase",
    url: CRUNCHBASE_URL,
    ariaLabel: "Booknomics company profile on Crunchbase",
  },
];

/** rel for business profile links: dofollow (entity verification) + safe new-tab behaviour. */
export const BUSINESS_PROFILE_REL = "noopener noreferrer";

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

/** Absolute URLs (no UTM) for SEO sameAs JSON-LD: social channels + business profiles. */
export const socialSameAs = (): string[] => [
  ...SOCIAL_LINKS.map((s) => s.url),
  ...BUSINESS_PROFILES.map((p) => p.url),
];
