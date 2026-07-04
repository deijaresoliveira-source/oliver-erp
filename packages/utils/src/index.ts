export function formatMoney(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export function limparTexto(texto: string) {
  return texto.trim().toLowerCase();
}
