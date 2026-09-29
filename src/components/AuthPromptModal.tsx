import { useNavigate } from "react-router-dom";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const AuthPromptModal = ({
  open,
  onOpenChange,
  title = "Unlock your full Action Plan",
  description = "Create a free account to access your personalised plan, 7-day tracker, and saved notes.",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
}) => {
  const navigate = useNavigate();
  const go = () => { onOpenChange(false); navigate("/auth"); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-gold/15 grid place-items-center mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="font-serif text-2xl text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm py-2">
          {["Full step-by-step Action System", "Live 7-day habit tracker + PDF", "Private notes & saved library", "100% free — no credit card"].map(t => (
            <li key={t} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={go} size="lg" className="bg-gold text-primary-foreground hover:opacity-90 rounded-full">
            Create free account
          </Button>
          <Button onClick={go} variant="ghost" size="sm" className="rounded-full">
            I already have an account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
