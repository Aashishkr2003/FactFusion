// pages/_app.tsx
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider, useSession } from "next-auth/react";
import Navbar from "../components/Navbar";
import { Provider } from "react-redux";
import { store } from "../store";

function MyAppContent({ Component, pageProps }: any) {
  const { data: session, status } = useSession();

  // Show only the page (no navbar) while loading or not signed in
  if (status === "loading" || !session) {
    return <Component {...pageProps} />;
  }

  // Show navbar + page if signed in
  return (
    <>
      <Navbar />
      <Component {...pageProps} />
    </>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Provider store={store}>
        <MyAppContent Component={Component} pageProps={pageProps} />
      </Provider>
    </SessionProvider>
  );
}
