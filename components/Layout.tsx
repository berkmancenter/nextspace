import { useRouter } from "next/router";
import type { Metadata } from "next";

import { Header } from "./Header";
import { Footer } from "./Footer";
import { AuthType } from "../types.internal";

export const metadata: Metadata = {
  title: "Nextspace",
  description: "",
};

/**
 * Layout component
 *
 * Wraps the main content of the app with a header and background.
 * @param children - The child components to render within the layout.
 * @param authType - The authentication type of the current user.
 * @returns A React component for the layout.
 */
export const Layout = ({
  children,
  authType = "guest",
}: Readonly<{ children: React.ReactNode; authType?: AuthType }>) => {
  const router = useRouter();
  const currentUrl = router.isReady ? router.asPath : "";

  // Pages where footer should be hidden (full-screen chat interfaces)
  const hideFooter = currentUrl.includes("conversationId");

  return (
    <div
      className={`min-h-screen flex flex-col ${
        currentUrl.includes("conversationId")
          ? "bg-[#FFFFFF]"
          : "bg-main bg-transparent bg-cover bg-center bg-no-repeat"
      }`}
    >
      <Header authType={authType} />

      <main className="flex-1">{children}</main>

      {!hideFooter && <Footer />}
    </div>
  );
};
