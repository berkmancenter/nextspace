import { useRouter } from "next/router";
import type { Metadata } from "next";

import { Header } from "./Header";
import { Footer } from "./Footer";

export const metadata: Metadata = {
  title: "Nextspace",
  description: "",
};

/**
 * Layout component
 *
 * Wraps the main content of the app with a header and background.
 * @param children - The child components to render within the layout.
 * @returns A React component for the layout.
 */
export const Layout = ({
  children,
  isAuthenticated,
}: Readonly<{ children: React.ReactNode; isAuthenticated: boolean }>) => {
  const router = useRouter();
  const currentUrl = router.isReady ? router.asPath : "";

  // Pages where footer should be hidden (full-screen chat interfaces)
  const hideFooter = currentUrl.includes("conversation");

  return (
    <div
      className={`min-h-screen flex flex-col ${
        currentUrl.includes("conversation")
          ? "bg-[#FFFFFF]"
          : "bg-main bg-transparent bg-cover bg-center bg-no-repeat"
      }`}
    >
      <Header isAuthenticated={isAuthenticated} />

      <main className="flex-1">{children}</main>

      {!hideFooter && <Footer />}
    </div>
  );
};
