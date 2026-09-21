/** Limite do arquivo .txt enviado em /api/importar. */
export const LIMITE_ARQUIVO_BYTES = 20 * 1024 * 1024;

/**
 * Limite do corpo inteiro da requisição: o arquivo mais 1 MB de envelope do
 * multipart. Precisa coincidir com `proxyClientMaxBodySize` em next.config.ts.
 */
export const LIMITE_CORPO_BYTES = 21 * 1024 * 1024;
