import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>⚒ Rift Architect — Chronicle Your Legendary Collection</title>
        <meta name="description" content="Forge vaults, inscribe relics, and chronicle your Riftbound TCG collection with fantasy-themed elegance." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚒</text></svg>" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
