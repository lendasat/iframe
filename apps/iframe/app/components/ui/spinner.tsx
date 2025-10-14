import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

export function Spinner({ className, size = "md" }: SpinnerProps) {
  return <Loader2 className={cn("animate-spin", sizeMap[size], className)} />;
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-8 shadow-lg">
        <Spinner size="xl" className="text-indigo-600" />
        {message && (
          <p className="text-sm font-medium text-gray-700">{message}</p>
        )}
      </div>
    </div>
  );
}
