import { Html, Head, Main, NextScript, DocumentContext, DocumentProps } from 'next/document';
import { DocumentHeadTags, DocumentHeadTagsProps, documentGetInitialProps } from '@mui/material-nextjs/v15-pagesRouter';
import { isTokenPage } from '../utils/tokenPrivacy';

export default function Document(props: DocumentProps & DocumentHeadTagsProps) {
  // Check if analytics is enabled (defaults to true if not set)
  const analyticsEnabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== 'false';
  const matomoUrl = process.env.NEXT_PUBLIC_MATOMO_URL;
  // Matomo reports the full page URL, which on these pages includes a one-time secret.
  const loadMatomo = analyticsEnabled && matomoUrl && !isTokenPage(props.__NEXT_DATA__.page);

  return (
    <Html lang="en">
      <Head>
        <DocumentHeadTags {...props} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* Matomo Tag Manager - Only load if analytics is enabled and URL is configured */}
        {loadMatomo && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
              var _mtm = window._mtm = window._mtm || [];
              _mtm.push({'mtm.startTime': (new Date().getTime()), 'event': 'mtm.Start'});
              (function() {
                var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
                g.async=true; g.src='${matomoUrl}'; s.parentNode.insertBefore(g,s);
              })();
            `,
            }}
          />
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
Document.getInitialProps = async (ctx: DocumentContext) => {
  const finalProps = await documentGetInitialProps(ctx);
  return finalProps;
};
