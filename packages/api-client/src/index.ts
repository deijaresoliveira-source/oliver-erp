export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Erro na comunicação com o servidor.');
  return response.json();
}
