import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Heart } from "lucide-react";
import { SOCIAL_LINKS, SOCIAL_REL, withUtm, type SocialPlacement } from "@/config/social";
import { SocialIcon } from "./SocialIcon";

interface Props {
  placement?: SocialPlacement;
  className?: string;
}

export const FollowMenu = ({ placement = "header_follow_dropdown", className }: Props) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`rounded-full gap-1.5 ${className ?? ""}`}
          aria-label="Follow Booknomics on social media"
        >
          <Heart className="h-4 w-4" /> Follow
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Follow Booknomics</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SOCIAL_LINKS.map((s) => (
          <DropdownMenuItem key={s.platform} asChild>
            <a
              href={withUtm(s.url, placement)}
              target="_blank"
              rel={SOCIAL_REL}
              aria-label={s.ariaLabel}
              className="flex items-center gap-2 cursor-pointer"
            >
              <SocialIcon platform={s.platform} className="h-4 w-4" />
              <span>{s.name}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
