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
};

export default nextConfig;
