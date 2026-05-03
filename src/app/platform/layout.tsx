import PlatformLayoutClient from "./PlatformLayoutClient";
import DialogProvider from "@/components/ui/DialogProvider";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <DialogProvider>
      <PlatformLayoutClient>{children}</PlatformLayoutClient>
    </DialogProvider>
  );
}

