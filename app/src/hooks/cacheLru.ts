/**
 * Cache LRU (menos usado recentemente sai primeiro) de tamanho fixo.
 *
 * Existe porque os Maps de módulo do `useRecursoRemoto` cresciam para sempre:
 * a chave é a URL inteira com filtros, então cada combinação de período ×
 * space × folder × list × responsável × status × prioridade virava uma entrada
 * permanente com o payload inteiro (193 KB no dashboard). Uma sessão longa
 * acumulava dezenas de MB na aba, e só `invalidarCache()` removia algo.
 *
 * Duas particularidades em relação a um LRU de livro-texto, ambas exigidas pelo
 * uso dentro de `useSyncExternalStore`:
 *
 * 1. A leitura vem em dois sabores. `espiar` NÃO mexe na ordem de uso e é a
 *    única segura de chamar durante o render (o `getSnapshot` do React chama a
 *    cada render e a cada notificação; reordenar ali seria efeito colateral no
 *    render, e ainda por cima caro). A promoção acontece em `tocar`, chamado de
 *    dentro de efeito, e em `definir`.
 * 2. Nenhuma das duas leituras troca a referência devolvida para a mesma
 *    entrada — o `getSnapshot` continua estável, sem loop de render.
 *
 * `protegida` blinda chaves que não podem sumir mesmo sendo as mais antigas
 * (no `useRecursoRemoto`: busca em andamento ou componente montado exibindo
 * aquela URL). Se todas as entradas estiverem protegidas o cache passa do
 * limite temporariamente — preferível a derrubar dado que está na tela.
 */
export class CacheLru<T> {
  private readonly mapa = new Map<string, T>();
  private readonly limite: number;
  private readonly protegida: (chave: string) => boolean;

  constructor(limite: number, protegida: (chave: string) => boolean = () => false) {
    if (limite < 1) throw new Error("CacheLru exige limite >= 1");
    this.limite = limite;
    this.protegida = protegida;
  }

  get tamanho(): number {
    return this.mapa.size;
  }

  /** Lê sem promover. Seguro durante o render. */
  espiar(chave: string): T | undefined {
    return this.mapa.get(chave);
  }

  tem(chave: string): boolean {
    return this.mapa.has(chave);
  }

  /** Promove a chave a mais recente, se existir. Chamar fora do render. */
  tocar(chave: string): void {
    if (!this.mapa.has(chave)) return;
    const valor = this.mapa.get(chave) as T;
    this.mapa.delete(chave);
    this.mapa.set(chave, valor);
  }

  /** Escreve e promove; despeja o excesso não protegido. */
  definir(chave: string, valor: T): void {
    this.mapa.delete(chave);
    this.mapa.set(chave, valor);
    this.despejar();
  }

  apagar(chave: string): boolean {
    return this.mapa.delete(chave);
  }

  limpar(): void {
    this.mapa.clear();
  }

  /** Cópia das chaves, da mais antiga para a mais recente. */
  chaves(): string[] {
    return [...this.mapa.keys()];
  }

  private despejar(): void {
    if (this.mapa.size <= this.limite) return;
    // Map itera na ordem de inserção — como `definir`/`tocar` reinserem, o
    // começo da iteração é a entrada mais antiga. Apagar durante a iteração de
    // um Map é seguro por especificação.
    for (const chave of this.mapa.keys()) {
      if (this.mapa.size <= this.limite) break;
      if (this.protegida(chave)) continue;
      this.mapa.delete(chave);
    }
  }
}
