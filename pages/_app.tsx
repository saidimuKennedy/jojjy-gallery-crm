import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import "@/styles/globals.css";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      {/* Bottom-left: the Assistant widget owns bottom-right. */}
      <Toaster position="bottom-left" />
    </SessionProvider>
  );
}
