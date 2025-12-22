import "../globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { AppCacheProvider } from "@mui/material-nextjs/v15-pagesRouter";
import {
  createTheme,
  StyledEngineProvider,
  ThemeProvider,
} from "@mui/material";
import { Layout } from "../components";
import { validateEnv } from "../utils/validateEnv";

// Validate environment variables on app initialization
if (typeof window === "undefined") {
  try {
    validateEnv();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Environment validation failed"
    );
    throw error;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const theme = createTheme({
    typography: {
      fontFamily: ["Inter Variable", "sans-serif"].join(","),
    },
  });

  return (
    <AppCacheProvider>
      <ThemeProvider theme={theme}>
        <Layout isAuthenticated={pageProps.isAuthenticated || false}>
          <Head>
            <title>NextSpace</title>
          </Head>
          <StyledEngineProvider injectFirst>
            <Component {...pageProps} />
          </StyledEngineProvider>
        </Layout>
      </ThemeProvider>
    </AppCacheProvider>
  );
}
