import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Documento HTML da versão web (só roda no build/servidor web, nunca no celular).
// Define o título da aba, o idioma e os metadados com a identidade do ConduzAPP.
// SDK 58: o expo-router injeta scripts e metadados por headNodes/bodyNodes;
// sem bodyNodes depois de children, a hidratação da página quebra.
export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } =
    useServerDocumentContext();
  return (
    <html lang="pt-BR" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>ConduzAPP</title>
        {/* Favicon = pino do brand.svg (assets/images/favicon.png, via app.json).
            O "?v=" força o navegador a trocar o ícone antigo guardado em cache. */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=conduzapp-pino" />
        <meta
          name="description"
          content="ConduzAPP: aulas de direção de 50 minutos com instrutores credenciados, agenda, pagamento e avaliação."
        />
        <meta name="theme-color" content="#1E2A78" />
        <meta property="og:title" content="ConduzAPP" />
        <meta
          property="og:description"
          content="Aulas de direção com instrutores credenciados."
        />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
