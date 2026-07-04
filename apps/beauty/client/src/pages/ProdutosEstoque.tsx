import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Boxes, Edit2, PackagePlus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageShell, SummaryCard } from '@/components/PageShell';

type Produto = {
  id: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  codigoBarras?: string;
  tipoProduto?: 'Comercialização' | 'Uso interno';
  estoqueAtual: number;
  estoqueMinimo: number;
  precoCusto: number;
  precoVenda: number;
  ativo?: boolean;
};

type Movimento = {
  id: string;
  produtoId: string;
  produtoNome: string;
  tipo: string;
  quantidade: number;
  origem?: string;
  criadoEm?: string;
};

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false) throw new Error(json?.error || 'Erro ao comunicar com o banco');
  return json?.data;
}

const moeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));

export default function ProdutosEstoque() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalProduto, setModalProduto] = useState(false);
  const [modalMovimento, setModalMovimento] = useState(false);
  const [modalCompra, setModalCompra] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [produtoMovimento, setProdutoMovimento] = useState<Produto | null>(null);
  const [busca, setBusca] = useState('');

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    categoria: '',
    codigoBarras: '',
    tipoProduto: 'Comercialização' as 'Comercialização' | 'Uso interno',
    estoqueAtual: 0,
    estoqueMinimo: 0,
    precoCusto: 0,
    precoVenda: 0,
  });

  const [movimento, setMovimento] = useState({ tipo: 'entrada', quantidade: 1, origem: 'Ajuste manual' });
  const [compra, setCompra] = useState({
    produtoId: '',
    quantidade: 1,
    valorUnitario: 0,
    fornecedor: '',
    data: new Date().toISOString().slice(0, 10),
    forma: 'Pix',
    status: 'Pendente' as 'Pendente' | 'Pago',
    observacao: '',
  });

  const carregar = async () => {
    setCarregando(true);
    try {
      const [p, m] = await Promise.all([api('/api/produtos'), api('/api/estoque-movimentacoes')]);
      setProdutos(p || []);
      setMovimentos(m || []);
    } catch (e: any) {
      alert('Erro ao carregar produtos/estoque: ' + e.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(
    () => produtos.filter((p) => [p.nome, p.categoria, p.codigoBarras, p.tipoProduto].join(' ').toLowerCase().includes(busca.toLowerCase())),
    [produtos, busca]
  );

  const estoqueBaixo = produtos.filter((p) => Number(p.estoqueAtual) <= Number(p.estoqueMinimo));
  const valorEstoque = produtos.reduce((s, p) => s + Number(p.estoqueAtual || 0) * Number(p.precoVenda || 0), 0);
  const produtosVenda = produtos.filter((p) => (p.tipoProduto || 'Comercialização') === 'Comercialização').length;
  const produtosUsoInterno = produtos.filter((p) => p.tipoProduto === 'Uso interno').length;

  const abrirProduto = (p?: Produto) => {
    if (p) {
      setEditando(p.id);
      setForm({
        nome: p.nome || '',
        descricao: p.descricao || '',
        categoria: p.categoria || '',
        codigoBarras: p.codigoBarras || '',
        tipoProduto: p.tipoProduto || 'Comercialização',
        estoqueAtual: Number(p.estoqueAtual || 0),
        estoqueMinimo: Number(p.estoqueMinimo || 0),
        precoCusto: Number(p.precoCusto || 0),
        precoVenda: Number(p.precoVenda || 0),
      });
    } else {
      setEditando(null);
      setForm({ nome: '', descricao: '', categoria: '', codigoBarras: '', tipoProduto: 'Comercialização', estoqueAtual: 0, estoqueMinimo: 0, precoCusto: 0, precoVenda: 0 });
    }
    setModalProduto(true);
  };

  const salvarProduto = async () => {
    try {
      if (!form.nome.trim()) return alert('Informe o nome do produto.');
      if (editando) {
        const salvo = await api(`/api/produtos/${editando}`, { method: 'PUT', body: JSON.stringify(form) });
        setProdutos((v) => v.map((p) => (p.id === editando ? salvo : p)));
      } else {
        const salvo = await api('/api/produtos', { method: 'POST', body: JSON.stringify(form) });
        setProdutos((v) => [salvo, ...v]);
      }
      setModalProduto(false);
      await carregar();
    } catch (e: any) {
      alert('Erro ao salvar produto: ' + e.message);
    }
  };

  const excluirProduto = async (id: string) => {
    try {
      if (!confirm('Excluir produto?')) return;
      await api(`/api/produtos/${id}`, { method: 'DELETE' });
      setProdutos((v) => v.filter((p) => p.id !== id));
    } catch (e: any) {
      alert('Erro ao excluir produto: ' + e.message);
    }
  };

  const abrirMovimento = (p: Produto, tipo = 'entrada') => {
    setProdutoMovimento(p);
    setMovimento({ tipo, quantidade: 1, origem: tipo === 'entrada' ? 'Entrada manual' : 'Saída manual' });
    setModalMovimento(true);
  };

  const salvarMovimento = async () => {
    try {
      if (!produtoMovimento) return;
      await api('/api/estoque-movimentacoes', {
        method: 'POST',
        body: JSON.stringify({ produtoId: produtoMovimento.id, tipo: movimento.tipo, quantidade: Number(movimento.quantidade || 0), origem: movimento.origem }),
      });
      await carregar();
      setModalMovimento(false);
    } catch (e: any) {
      alert('Erro ao movimentar estoque: ' + e.message);
    }
  };

  const abrirCompra = () => {
    setCompra({ produtoId: produtos[0]?.id || '', quantidade: 1, valorUnitario: 0, fornecedor: '', data: new Date().toISOString().slice(0, 10), forma: 'Pix', status: 'Pendente', observacao: '' });
    setModalCompra(true);
  };

  const salvarCompra = async () => {
    try {
      if (!compra.produtoId) return alert('Selecione o produto comprado.');
      if (Number(compra.quantidade || 0) <= 0) return alert('Informe a quantidade.');
      if (Number(compra.valorUnitario || 0) <= 0) return alert('Informe o valor unitário.');

      await api('/api/produtos/registrar-compra', { method: 'POST', body: JSON.stringify(compra) });
      alert('Compra registrada: estoque atualizado, movimentação criada e despesa lançada.');
      setModalCompra(false);
      await carregar();
    } catch (e: any) {
      alert('Erro ao registrar compra: ' + e.message);
    }
  };

  const valorTotalCompra = Number(compra.quantidade || 0) * Number(compra.valorUnitario || 0);
  const movimentosRecentes = movimentos.slice(0, 8);

  return (
    <PageShell
      title="Produtos / Estoque"
      subtitle="Produtos de venda e uso interno. Compras geram despesa, entrada de estoque e movimentação em um só lugar."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button onClick={abrirCompra} variant="outline"><ShoppingCart className="mr-1 h-4 w-4" />Registrar compra</Button>
          <Button onClick={() => abrirProduto()}><PackagePlus className="mr-1 h-4 w-4" />Novo produto</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <SummaryCard title="Produtos" value={produtos.length} icon={<Boxes className="h-5 w-5" />} />
          <SummaryCard title="Para venda" value={produtosVenda} icon={<PackagePlus className="h-5 w-5" />} tone="green" />
          <SummaryCard title="Uso interno" value={produtosUsoInterno} icon={<Boxes className="h-5 w-5" />} tone="blue" />
          <SummaryCard title="Estoque baixo" value={estoqueBaixo.length} icon={<AlertTriangle className="h-5 w-5" />} tone={estoqueBaixo.length ? 'amber' : 'green'} />
          <SummaryCard title="Valor em estoque" value={moeda(valorEstoque)} icon={<PackagePlus className="h-5 w-5" />} tone="primary" />
        </div>

        <div className="rounded-2xl border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2 rounded-xl border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar produto, categoria, tipo ou código..." className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
          </div>
        </div>

        {carregando ? (
          <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">Carregando produtos...</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Produto</th>
                    <th className="px-4 py-3 text-left font-bold">Categoria</th>
                    <th className="px-4 py-3 text-left font-bold">Tipo</th>
                    <th className="px-4 py-3 text-left font-bold">Código</th>
                    <th className="px-4 py-3 text-center font-bold">Estoque</th>
                    <th className="px-4 py-3 text-center font-bold">Mínimo</th>
                    <th className="px-4 py-3 text-right font-bold">Custo</th>
                    <th className="px-4 py-3 text-right font-bold">Venda</th>
                    <th className="px-4 py-3 text-center font-bold">Movimento</th>
                    <th className="px-4 py-3 text-center font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtrados.map((p) => {
                    const baixo = Number(p.estoqueAtual) <= Number(p.estoqueMinimo);
                    return (
                      <tr key={p.id} className={`transition hover:bg-secondary/40 ${baixo ? 'bg-amber-500/10' : ''}`}>
                        <td className="px-4 py-3 align-top">
                          <p className="font-bold">{p.nome}</p>
                          {p.descricao && <p className="mt-1 max-w-[320px] text-xs text-muted-foreground">{p.descricao}</p>}
                          {baixo && <p className="mt-1 text-xs font-semibold text-amber-500">Estoque mínimo atingido</p>}
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{p.categoria || 'Sem categoria'}</td>
                        <td className="px-4 py-3 align-top">{p.tipoProduto || 'Comercialização'}</td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{p.codigoBarras || '-'}</td>
                        <td className={`px-4 py-3 text-center align-top font-black ${baixo ? 'text-amber-500' : 'text-emerald-500'}`}>{p.estoqueAtual}</td>
                        <td className="px-4 py-3 text-center align-top">{p.estoqueMinimo}</td>
                        <td className="px-4 py-3 text-right align-top font-semibold">{moeda(p.precoCusto)}</td>
                        <td className="px-4 py-3 text-right align-top font-semibold">{moeda(p.precoVenda)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex justify-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => abrirMovimento(p, 'entrada')}><ArrowUpCircle className="mr-1 h-4 w-4" />Entrada</Button>
                            <Button size="sm" variant="outline" onClick={() => abrirMovimento(p, 'saida')}><ArrowDownCircle className="mr-1 h-4 w-4" />Saída</Button>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex justify-center gap-2">
                            <Button size="icon" variant="outline" onClick={() => abrirProduto(p)}><Edit2 className="h-4 w-4" /></Button>
                            <Button size="icon" variant="outline" onClick={() => excluirProduto(p.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtrados.length && (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Últimas movimentações</h2>
          <div className="space-y-2">
            {movimentosRecentes.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3 text-sm">
                <div>
                  <p className="font-semibold">{m.produtoNome}</p>
                  <p className="text-xs text-muted-foreground">{m.origem} • {m.criadoEm}</p>
                </div>
                <p className={m.tipo === 'entrada' ? 'font-black text-emerald-500' : 'font-black text-red-500'}>{m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}</p>
              </div>
            ))}
            {!movimentosRecentes.length && <p className="py-6 text-center text-muted-foreground">Nenhuma movimentação registrada.</p>}
          </div>
        </div>
      </div>

      <Dialog open={modalProduto} onOpenChange={setModalProduto}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-card">
          <DialogHeader><DialogTitle>{editando ? 'Editar Produto' : 'Novo Produto'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Bebida, Shampoo, Creme..." /></div>
              <div><Label>Tipo do produto</Label><select className="w-full rounded-xl border bg-background p-3" value={form.tipoProduto} onChange={(e) => setForm({ ...form, tipoProduto: e.target.value as any })}><option>Comercialização</option><option>Uso interno</option></select></div>
            </div>
            <div><Label>Código de barras</Label><Input value={form.codigoBarras} onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Estoque atual</Label><Input type="number" value={form.estoqueAtual} onChange={(e) => setForm({ ...form, estoqueAtual: Number(e.target.value) })} /></div>
              <div><Label>Estoque mínimo</Label><Input type="number" value={form.estoqueMinimo} onChange={(e) => setForm({ ...form, estoqueMinimo: Number(e.target.value) })} /></div>
              <div><Label>Preço custo</Label><Input type="number" value={form.precoCusto} onChange={(e) => setForm({ ...form, precoCusto: Number(e.target.value) })} /></div>
              <div><Label>Preço venda</Label><Input type="number" value={form.precoVenda} onChange={(e) => setForm({ ...form, precoVenda: Number(e.target.value) })} /></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModalProduto(false)}>Cancelar</Button><Button onClick={salvarProduto}>Salvar</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modalMovimento} onOpenChange={setModalMovimento}>
        <DialogContent className="border-border bg-card">
          <DialogHeader><DialogTitle>Movimentar estoque</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="font-bold">{produtoMovimento?.nome}</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label><select className="w-full rounded-xl border bg-background p-3" value={movimento.tipo} onChange={(e) => setMovimento({ ...movimento, tipo: e.target.value })}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></div>
              <div><Label>Quantidade</Label><Input type="number" value={movimento.quantidade} onChange={(e) => setMovimento({ ...movimento, quantidade: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Origem/observação</Label><Input value={movimento.origem} onChange={(e) => setMovimento({ ...movimento, origem: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModalMovimento(false)}>Cancelar</Button><Button onClick={salvarMovimento}>Salvar</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modalCompra} onOpenChange={setModalCompra}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-card sm:max-w-2xl">
          <DialogHeader><DialogTitle>Registrar compra de produto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produto comprado *</Label>
              <select className="w-full rounded-xl border bg-background p-3" value={compra.produtoId} onChange={(e) => setCompra({ ...compra, produtoId: e.target.value })}>
                <option value="">Selecione</option>
                {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} - {p.tipoProduto || 'Comercialização'}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div><Label>Quantidade *</Label><Input type="number" min={1} value={compra.quantidade} onChange={(e) => setCompra({ ...compra, quantidade: Number(e.target.value) })} /></div>
              <div><Label>Valor unitário *</Label><Input type="number" min={0} value={compra.valorUnitario} onChange={(e) => setCompra({ ...compra, valorUnitario: Number(e.target.value) })} /></div>
              <div><Label>Total</Label><Input readOnly value={moeda(valorTotalCompra)} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div><Label>Fornecedor</Label><Input value={compra.fornecedor} onChange={(e) => setCompra({ ...compra, fornecedor: e.target.value })} /></div>
              <div><Label>Data da compra</Label><Input type="date" value={compra.data} onChange={(e) => setCompra({ ...compra, data: e.target.value })} /></div>
              <div><Label>Forma de pagamento</Label><select className="w-full rounded-xl border bg-background p-3" value={compra.forma} onChange={(e) => setCompra({ ...compra, forma: e.target.value })}><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option></select></div>
              <div><Label>Status da despesa</Label><select className="w-full rounded-xl border bg-background p-3" value={compra.status} onChange={(e) => setCompra({ ...compra, status: e.target.value as any })}><option>Pendente</option><option>Pago</option></select></div>
            </div>
            <div><Label>Observação</Label><Textarea value={compra.observacao} onChange={(e) => setCompra({ ...compra, observacao: e.target.value })} /></div>
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              Ao salvar, o sistema vai aumentar o estoque, registrar a movimentação e criar a despesa automaticamente.
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModalCompra(false)}>Cancelar</Button><Button className="btn-premium" onClick={salvarCompra}>Salvar compra</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
