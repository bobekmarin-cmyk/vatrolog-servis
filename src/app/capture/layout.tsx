import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CaptureLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-transparent">{children}</div>;
}
