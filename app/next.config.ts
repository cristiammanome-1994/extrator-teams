import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Desativa o indicador flutuante de dev ("N") no canto da tela.
  devIndicators: false,
  experimental: {
    // Com o proxy de sessão ativo o Next copia o corpo da requisição na
    // memória e, sem isto, truncaria em silêncio um upload acima de 10 MB.
    // 21 MB = limite de 20 MB do arquivo + o envelope do multipart.
    proxyClientMaxBodySize: "21mb",
  },
  // Nada no app usa <iframe>, então nada precisa carregá-lo dentro de um: X-Frame-Options cobre
  // navegador antigo, frame-ancestors é o padrão atual (tem precedência onde os dois existem).
  // Verificado por scripts/verificar-api.mjs (SEG-1) contra um servidor real — este arquivo só
  // é aplicado pelo servidor completo do Next, não pelos testes unitários que importam rotas direto.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
