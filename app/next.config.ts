import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Desativa o indicador flutuante de dev ("N") no canto da tela.
  devIndicators: false,
};

export default nextConfig;
