import "./globals.css";
import type { Metadata } from "next";
import { getAirflowTargets } from "@/lib/registry";
import { getSupersetConfig } from "@/lib/superset";
import TopBar from "@/components/TopBar";
import Toaster from "@/components/Toast";

export const metadata: Metadata = {
  title: "ServerOps Dashboard",
  description: "Operate services across your Linux fleet from one place.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const airflowTargets = getAirflowTargets();
  const supersetEnabled = Boolean(getSupersetConfig());
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body>
        <TopBar airflowTargets={airflowTargets} supersetEnabled={supersetEnabled} />
        <main className="container">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
