import { notFound } from "next/navigation";
import BrowserFrame from "@/app/_landing/BrowserFrame";
import { HeroMock } from "@/app/_landing/Hero";
import {
  WorkOrderMock,
  ServiceMock,
  DeliveryNoteMock,
  RegisterMock,
} from "@/app/_landing/Screenshots";

type MockupSlug = "hero" | "work-order" | "service" | "delivery" | "register";

const MOCKUPS: Record<
  MockupSlug,
  { Component: () => React.ReactElement; url: string; defaultWidth: number }
> = {
  hero: {
    Component: HeroMock,
    url: "vatrolog.com/work-orders",
    defaultWidth: 1100,
  },
  "work-order": {
    Component: WorkOrderMock,
    url: "vatrolog.com/work-orders/26-05-001",
    defaultWidth: 1100,
  },
  service: {
    Component: ServiceMock,
    url: "vatrolog.com/work-orders/26-05-001/service/01050003",
    defaultWidth: 1100,
  },
  delivery: {
    Component: DeliveryNoteMock,
    url: "vatrolog.com/work-orders/26-05-001/otpremnica",
    defaultWidth: 820,
  },
  register: {
    Component: RegisterMock,
    url: "vatrolog.com/work-orders/26-05-001/upisnik",
    defaultWidth: 820,
  },
};

function isSlug(s: string): s is MockupSlug {
  return s in MOCKUPS;
}

export default async function CapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ w?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const { name } = await params;
  const { w } = await searchParams;
  if (!isSlug(name)) notFound();

  const cfg = MOCKUPS[name];
  const width = Number(w) || cfg.defaultWidth;
  const { Component } = cfg;

  return (
    <div className="inline-block bg-transparent p-0">
      <div data-capture-target style={{ width }}>
        <BrowserFrame url={cfg.url}>
          <Component />
        </BrowserFrame>
      </div>
    </div>
  );
}
