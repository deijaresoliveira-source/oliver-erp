import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Wallet, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useState } from 'react';
import { PageShell, SummaryCard } from '@/components/PageShell';

type Movimento = {
  id: string;
  tipo: 'Entrada' | 'Saída';
  descricao: string;
  categoria: string;
  valor: number;
  valorBruto?: number;
  taxaPercentual?: number;
  valorTaxa?: number;
  valorLiquido?: number;
  data: string;
  forma: string;
  status: 'Pago' | 'Pendente';
};

const moeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

async function api(path: string, options: RequestInit = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Erro na API');
  return j?.data;
}

const dataInput = (data: string) => {
  if (!data) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [d, m, y] = data.split('/');
    return `${y}-${m}-${d}`;
  }
  return data.slice(0, 10);
};

const dataBR = (data: string) => {
  if (!data) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [y, m, d] = data.split('-');
    return `${d}/${m}/${y}`;
  }
  return data;
};

const dentroPeriodo = (dataBrOuIso: string, inicio: string, fim: string) => {
  const iso = dataInput(dataBrOuIso);
  if (!iso) return true;
  if (inicio && iso < inicio) return false;
  if (fim && iso > fim) return false;
  return true;
};

export default function FluxoCaixa() {
  const [movs, setMovs] = useState<Movimento[]>([]);
  const [form, setForm] = useState({
    tipo: 'Entrada' as Movimento['tipo'],
    descricao: '',
    categoria: 'Manual',
    valor: '',
    taxaPercentual: '',
    data: new Date().toISOString().slice(0, 10),
    forma: 'Pix',
    status: 'Pago' as Movimento['status'],
  });
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    tipo: 'Todos',
    categoria: 'Todas',
    forma: 'Todas',
    status: 'Todos',
  });

  const carregar = () =>
    api('/api/fluxo-caixa')
      .then((dados) => setMovs(dados || []))
      .catch((e) => alert('Erro ao carregar fluxo de caixa: ' + e.message));

  useEffect(() => {
    carregar();
  }, []);

  const categorias = useMemo(() => ['Todas', ...Array.from(new Set(movs.map((m) => m.categoria).filter(Boolean)))], [movs]);
  const formas = useMemo(() => ['Todas', ...Array.from(new Set(movs.map((m) => m.forma).filter(Boolean)))], [movs]);

  const filtrados = useMemo(() => {
    return movs.filter((m) => {
      if (!dentroPeriodo(m.data, filtros.dataInicio, filtros.dataFim)) return false;
      if (filtros.tipo !== 'Todos' && m.tipo !== filtros.tipo) return false;
      if (filtros.categoria !== 'Todas' && m.categoria !== filtros.categoria) return false;
      if (filtros.forma !== 'Todas' && m.forma !== filtros.forma) return false;
      if (filtros.status !== 'Todos' && m.status !== filtros.status) return false;
      return true;
    });
  }, [movs, filtros]);

  const pagos = filtrados.filter((m) => m.status === 'Pago');
  const entradasBrutas = pagos.filter((m) => m.tipo === 'Entrada').reduce((s, m) => s + Number(m.valorBruto || m.valor || 0), 0);
  const taxas = pagos.filter((m) => m.tipo === 'Entrada').reduce((s, m) => s + Number(m.valorTaxa || 0), 0);
  const entradas = pagos.filter((m) => m.tipo === 'Entrada').reduce((s, m) => s + Number(m.valorLiquido || m.valor || 0), 0);
  const saidas = pagos.filter((m) => m.tipo === 'Saída').reduce((s, m) => s + Number(m.valor || 0), 0);
  const saldo = entradas - saidas;

  const add = async () => {
    try {
      if (!form.descricao || !form.valor) return alert('Informe descrição e valor.');
      const novo = await api('/api/fluxo-caixa', { method: 'POST', body: JSON.stringify({ ...form, taxaPercentual: Number(String(form.taxaPercentual || '0').replace(',', '.')) || 0 }) });
      setMovs((v) => [novo, ...v]);
      setForm({ ...form, descricao: '', valor: '' });
    } catch (e: any) {
      alert('Erro ao salvar no banco: ' + e.message);
    }
  };

  const excluir = async (id: string) => {
    try {
      if (!confirm('Excluir movimento?')) return;
      await api(`/api/fluxo-caixa/${id}`, { method: 'DELETE' });
      setMovs((v) => v.filter((x) => x.id !== id));
    } catch (e: any) {
      alert('Erro ao excluir no banco: ' + e.message);
    }
  };

  const limparFiltros = () => setFiltros({ dataInicio: '', dataFim: '', tipo: 'Todos', categoria: 'Todas', forma: 'Todas', status: 'Todos' });

  return (
    <PageShell title="Fluxo de Caixa" subtitle="Entradas, saídas, saldo e lançamentos financeiros reais." actions={<Button onClick={add}><Plus className="mr-1 h-4 w-4" />Lançar</Button>}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryCard title="Entradas líquidas" value={moeda(entradas)} icon={<ArrowUpCircle className="h-5 w-5" />} tone="green" />
          <SummaryCard title="Taxas cartão" value={moeda(taxas)} icon={<ArrowDownCircle className="h-5 w-5" />} tone="red" />
          <SummaryCard title="Saídas pagas" value={moeda(saidas)} icon={<ArrowDownCircle className="h-5 w-5" />} tone="red" />
          <SummaryCard title="Saldo" value={moeda(saldo)} icon={<Wallet className="h-5 w-5" />} tone="primary" />
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 font-bold"><Filter className="h-4 w-4" />Filtros</div>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <input type="date" className="rounded-xl border bg-background p-3" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
            <input type="date" className="rounded-xl border bg-background p-3" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
            <select className="rounded-xl border bg-background p-3" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}><option>Todos</option><option>Entrada</option><option>Saída</option></select>
            <select className="rounded-xl border bg-background p-3" value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}>{categorias.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="rounded-xl border bg-background p-3" value={filtros.forma} onChange={(e) => setFiltros({ ...filtros, forma: e.target.value })}>{formas.map((f) => <option key={f}>{f}</option>)}</select>
            <select className="rounded-xl border bg-background p-3" value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}><option>Todos</option><option>Pago</option><option>Pendente</option></select>
          </div>
          <Button variant="outline" className="mt-3" onClick={limparFiltros}>Limpar filtros</Button>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="mb-3 font-bold">Novo lançamento manual</p>
          <div className="grid gap-2 md:grid-cols-7">
            <select className="rounded-xl border bg-background p-3" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}><option>Entrada</option><option>Saída</option></select>
            <input className="rounded-xl border bg-background p-3 md:col-span-2" placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            <input className="rounded-xl border bg-background p-3" placeholder="Categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            <input type="number" className="rounded-xl border bg-background p-3" placeholder="Valor bruto" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            <input type="number" className="rounded-xl border bg-background p-3" placeholder="Taxa %" value={form.taxaPercentual} onChange={(e) => setForm({ ...form, taxaPercentual: e.target.value })} />
            <select className="rounded-xl border bg-background p-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}><option>Pago</option><option>Pendente</option></select>
            <Button onClick={add}><Plus className="mr-1 h-4 w-4" />Lançar</Button>
          </div>
        </div>

        <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
          <table className="w-full text-sm">
            <thead><tr className="bg-secondary/60"><th className="p-4 text-left">Descrição</th><th className="p-4">Tipo</th><th className="p-4">Categoria</th><th className="p-4">Data</th><th className="p-4">Forma</th><th className="p-4">Status</th><th className="p-4 text-right">Valor</th><th className="p-4"></th></tr></thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-4 font-medium">{m.descricao}</td><td className="p-4 text-center">{m.tipo}</td><td className="p-4 text-center">{m.categoria}</td><td className="p-4 text-center">{dataBR(m.data)}</td><td className="p-4 text-center">{m.forma}</td><td className="p-4 text-center"><span className="rounded-full bg-primary/15 px-3 py-1 text-primary">{m.status}</span></td><td className={`p-4 text-right font-bold ${m.tipo === 'Entrada' ? 'text-emerald-500' : 'text-red-500'}`}>{moeda(m.valor)}</td><td className="p-4 text-right"><Button size="icon" variant="outline" onClick={() => excluir(m.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
              {!filtrados.length && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Nenhum movimento encontrado.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {filtrados.map((m) => (
            <div key={m.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex justify-between gap-3"><div><p className="font-bold">{m.descricao}</p><p className="text-xs text-muted-foreground">{m.categoria} • {dataBR(m.data)} • {m.forma}</p></div><p className={`font-black ${m.tipo === 'Entrada' ? 'text-emerald-500' : 'text-red-500'}`}>{moeda(m.valor)}</p></div>
              <div className="mt-3 flex items-center justify-between"><span className="rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">{m.status}</span><Button size="sm" variant="outline" onClick={() => excluir(m.id)}><Trash2 className="mr-1 h-4 w-4" />Excluir</Button></div>
            </div>
          ))}
          {!filtrados.length && <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Nenhum movimento encontrado.</div>}
        </div>
      </div>
    </PageShell>
  );
}
