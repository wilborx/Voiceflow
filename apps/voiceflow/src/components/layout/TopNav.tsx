import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopNavProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function TopNav({ title, subtitle, action }: TopNavProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-6 bg-background/95 backdrop-blur border-b border-border">
      <div>
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {action}
        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-notifications">
          <Bell size={15} />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-profile">
          <User size={15} />
        </Button>
      </div>
    </header>
  );
}
