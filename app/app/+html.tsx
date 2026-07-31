import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';
import type { PropsWithChildren } from 'react';

// Shell HTML de la versión WEB (nativo lo ignora). Existe para que el navegador
// se comporte como una app y no como una página: sin zoom de pinza, sin rebote
// al arrastrar y sin selección de texto — la pantalla es un objeto, no un
// documento. El fondo va en negro obsidiana para que no haya destello blanco
// antes de que monte React.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#04050A" />
        <title>I&apos;m Rich</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: APP_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: BLOCK_PAGE_ZOOM_JS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const APP_CSS = `
html, body {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  background-color: #04050A;
  touch-action: manipulation;
}
body {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
#root {
  height: 100%;
}
`;

const BLOCK_PAGE_ZOOM_JS = `
// iOS Safari ignora user-scalable=no — el pinch de página se cancela a mano.
document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
document.addEventListener('gesturechange', function (e) { e.preventDefault(); });
// Ctrl+rueda (zoom de página en escritorio) también se bloquea.
document.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
`;
