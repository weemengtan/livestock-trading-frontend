import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/buyer/service-worker-registration";

// §12.7's install flow — manifest/theme-color/apple metadata scoped to
// this segment only, so the Trading Console pages stay a plain web app.
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "DNBP Buyer" },
  // iOS Safari's "Add to Home Screen" icon fidelity across versions is
  // inconsistent when relying on manifest.webmanifest alone (Android/
  // Chrome reads that manifest correctly) — an explicit apple-touch-icon
  // link is the reliable cross-iOS-version way to set the home-screen icon.
  icons: { apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#1c63d6",
  width: "device-width",
  initialScale: 1,
  // §15.6 WCAG 2.2 AA (1.4.4/1.4.10) — pinch-zoom must never be disabled.
  // `maximumScale: 1` was here (presumably to stop accidental double-tap
  // zoom on the numeric keypad) but it's a real accessibility regression —
  // axe-core's meta-viewport rule caught it live, and disabling zoom hurts
  // exactly the low-vision buyers §12.1's Yard Mode already exists for.
};

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegistration />
      {children}
    </>
  );
}
