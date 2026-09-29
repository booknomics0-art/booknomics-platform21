import { Instagram, Facebook, Youtube } from "lucide-react";
import type { SocialPlatform } from "@/config/social";

interface Props {
  platform: SocialPlatform;
  className?: string;
}

// Threads & Pinterest are not in lucide-react — use lightweight inline SVGs.
const ThreadsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.3 11.2c-.1 0-.2-.1-.3-.1-.2-3-1.9-4.8-4.6-4.8-1.6 0-3 .7-3.8 1.9l1.5 1c.6-.9 1.5-1.1 2.3-1.1 1 0 1.8.3 2.3.9.4.4.6 1 .7 1.7-.9-.2-1.8-.3-2.8-.2-2.8.2-4.6 1.8-4.5 4 .1 1.1.6 2 1.5 2.7.8.5 1.8.8 2.9.7 1.5-.1 2.6-.6 3.4-1.7.6-.8.9-1.9 1.1-3.2.6.4 1.1.9 1.4 1.5.5 1 .5 2.6-.8 3.9-1.1 1.1-2.5 1.6-4.5 1.6-2.3 0-4-.7-5.1-2.2C6.1 16.3 5.6 14.5 5.5 12S6 7.7 7 6.4c1.1-1.5 2.8-2.2 5.1-2.3 2.4 0 4.1.7 5.2 2.3.6.8 1 1.7 1.2 2.9l1.7-.5c-.3-1.4-.8-2.5-1.5-3.4C17.3 3.4 15.1 2.5 12.2 2.5h-.1c-2.9 0-5.1 1-6.7 2.9-1.4 1.7-2.1 4.1-2.1 7.1s.7 5.4 2.1 7.1c1.6 1.9 3.8 2.9 6.7 2.9h.1c2.6 0 4.5-.7 6-2.1 2-1.9 1.9-4.4 1.3-5.8-.5-1-1.3-1.8-2.5-2.5zM12.4 15.7c-1.2.1-2.5-.5-2.6-1.7-.1-.9.6-1.9 2.7-2.1h.6c.7 0 1.4.1 2 .2-.2 3-1.6 3.5-2.7 3.6z"/>
  </svg>
);

const PinterestIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2C6.5 2 2 6.5 2 12c0 4.2 2.6 7.8 6.3 9.3-.1-.8-.2-2 0-2.9.2-.8 1.2-4.9 1.2-4.9s-.3-.6-.3-1.5c0-1.4.8-2.5 1.9-2.5.9 0 1.3.7 1.3 1.5 0 .9-.6 2.3-.9 3.6-.3 1.1.5 2 1.6 2 1.9 0 3.4-2 3.4-5 0-2.6-1.9-4.4-4.6-4.4-3.1 0-5 2.3-5 4.8 0 .9.4 2 .8 2.5.1.1.1.2.1.3-.1.3-.3 1.1-.3 1.3 0 .2-.2.3-.4.2-1.4-.7-2.3-2.8-2.3-4.5 0-3.6 2.6-7 7.6-7 4 0 7.1 2.8 7.1 6.6 0 4-2.5 7.2-6 7.2-1.2 0-2.3-.6-2.7-1.3l-.7 2.8c-.3 1-1 2.3-1.4 3.1.8.4 2 .6 3 .6 5.5 0 10-4.5 10-10S17.5 2 12 2z"/>
  </svg>
);

export const SocialIcon = ({ platform, className = "h-4 w-4" }: Props) => {
  switch (platform) {
    case "instagram":
      return <Instagram className={className} aria-hidden="true" />;
    case "facebook":
      return <Facebook className={className} aria-hidden="true" />;
    case "youtube-hindi":
    case "youtube-english":
      return <Youtube className={className} aria-hidden="true" />;
    case "threads":
      return <ThreadsIcon className={className} />;
    case "pinterest":
      return <PinterestIcon className={className} />;
  }
};
