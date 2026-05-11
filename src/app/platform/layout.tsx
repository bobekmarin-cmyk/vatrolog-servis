import type { Metadata } from "next";
import PlatformLayoutClient from "./PlatformLayoutClient";
import DialogProvider from "@/components/ui/DialogProvider";

/**
 * Sve /platform rute su vendor (admin) prostor iza prijave — noindex,nofollow.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <DialogProvider>
      <PlatformLayoutClient>{children}</PlatformLayoutClient>
    </DialogProvider>
  );
}

