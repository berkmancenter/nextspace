import { useRouter } from 'next/router';
import type { Metadata } from 'next';

import { Header } from './Header';
import { Footer } from './Footer';
import { AuthType } from '../types.internal';

export const metadata: Metadata = {
  title: 'Nextspace',
  description: '',
};

/**
 * Layout component
 *
 * Wraps the main content of the app with a header and background.
 * @param children - The child components to render within the layout.
 * @param authType - The authentication type of the current user.
 * @returns A React component for the layout.
 */
export const Layout = ({ children, authType = 'guest' }: Readonly<{ children: React.ReactNode; authType?: AuthType }>) => {
  const router = useRouter();
  const currentUrl = router.isReady ? router.asPath : '';

  // The community room and the lounge draw their own header and fill the viewport, so
  // the app's header and footer would frame a second header and push them into a
  // scroll. A room's asPath carries a room id rather than the literal
  // "conversationId", so the check below can't see it.
  const isRoomRoute = router.pathname.startsWith('/room') || router.pathname.startsWith('/lounge');

  // Pages where footer should be hidden (full-screen chat interfaces)
  const hideFooter = isRoomRoute || currentUrl.includes('conversationId');

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isRoomRoute || currentUrl.includes('conversationId')
          ? 'bg-[#FFFFFF]'
          : 'bg-main bg-transparent bg-cover bg-center bg-no-repeat'
      }`}
    >
      {!isRoomRoute && <Header authType={authType} />}

      <main className="flex-1">{children}</main>

      {!hideFooter && <Footer />}
    </div>
  );
};
