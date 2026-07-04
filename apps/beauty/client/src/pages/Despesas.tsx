import { Button } from '@/components/ui/button';
import { Plus, Trash2, AlertTriangle, CheckCircle2, CheckSquare, Square, CreditCard, Filter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageShell, SummaryCard } from '@/components/PageShell';

type StatusDespesa = 'Pendente' | 'Pago' | 'Vencido' | 'Estornado';
type Despesa = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  dataPagamento?: string;
  lotePagamento?: string;
  forma: string;
  fornecedor: string;
  status: StatusDespesa;
  observacao: string;
  recorrente: boolean;
  motivoEstorno?: string;
  dataEstorno?: string;
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

export default function Despesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [formaLote, setFormaLote] = useState('Pix');
  const [dataPagamentoLote, setDataPagamentoLote] = useState(new Date().toISOString().slice(0, 10));
  const [observacaoLote, setObservacaoLote] = useState('');
  const [modalEstorno, setModalEstorno] = useState<Despesa | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');
  const [dataEstorno, setDataEstorno] = useState(new Date().toISOString().slice(0, 10));

  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    dataPagamentoInicio: '',
    dataPagamentoFim: '',
    categoria: 'Todas',
    status: 'Todos',
    profissional: 'Todos',
    forma: 'Todas',
  });

  const [form, setForm] = useState({
    descricao: '',
    categoria: 'Produtos',
    valor: '',
    data: new Date().toISOString().slice(0, 10),
    forma: 'Pix',
    fornecedor: '',
    status: 'Pendente' as StatusDespesa,
    observacao: '',
    recorrente: false,
  });

  const carregar = () =>
    api('/api/despesas')
      .then((dados) => setDespesas(dados || []))
      .catch((e) => alert('Erro ao carregar despesas: ' + e.message));

  useEffect(() => {
    carregar();
  }, []);

  const categorias = useMemo(
    () => ['Todas', ...Array.from(new Set(despesas.map((d) => d.categoria).filter(Boolean)))],
    [despesas]
  );

  const profissionais = useMemo(
    () => ['Todos', ...Array.from(new Set(despesas.filter((d) => d.categoria === 'Comissão').map((d) => d.fornecedor).filter(Boolean)))],
    [despesas]
  );

  const formasPagamento = useMemo(
    () => ['Todas', ...Array.from(new Set(despesas.map((d) => d.forma).filter(Boolean)))],
    [despesas]
  );

  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      if (!dentroPeriodo(d.data, filtros.dataInicio, filtros.dataFim)) return false;
      if (!dentroPeriodo(d.dataPagamento || '', filtros.dataPagamentoInicio, filtros.dataPagamentoFim)) return false;
      if (filtros.categoria !== 'Todas' && d.categoria !== filtros.categoria) return false;
      if (filtros.status !== 'Todos' && d.status !== filtros.status) return false;
      if (filtros.profissional !== 'Todos' && d.fornecedor !== filtros.profissional) return false;
      if (filtros.forma !== 'Todas' && d.forma !== filtros.forma) return false;
      return true;
    });
  }, [despesas, filtros]);

  const resumo = useMemo(
    () => ({
      pago: despesasFiltradas.filter((d) => d.status === 'Pago').reduce((s, d) => s + Number(d.valor || 0), 0),
      pendente: despesasFiltradas.filter((d) => d.status === 'Pendente').reduce((s, d) => s + Number(d.valor || 0), 0),
      vencido: despesasFiltradas.filter((d) => d.status === 'Vencido').reduce((s, d) => s + Number(d.valor || 0), 0),
      estornado: despesasFiltradas.filter((d) => d.status === 'Estornado').reduce((s, d) => s + Number(d.valor || 0), 0),
      comissaoPendente: despesasFiltradas.filter((d) => d.categoria === 'Comissão' && d.status === 'Pendente').reduce((s, d) => s + Number(d.valor || 0), 0),
    }),
    [despesasFiltradas]
  );

  const comissoesPendentesFiltradas = useMemo(
    () => despesasFiltradas.filter((d) => d.categoria === 'Comissão' && d.status === 'Pendente'),
    [despesasFiltradas]
  );

  const totalSelecionado = useMemo(
    () => despesas.filter((d) => selecionadas.includes(d.id)).reduce((s, d) => s + Number(d.valor || 0), 0),
    [despesas, selecionadas]
  );

  const salvar = async () => {
    try {
      if (!form.descricao || !form.valor) return alert('Informe descrição e valor.');
      const novo = await api('/api/despesas', { method: 'POST', body: JSON.stringify({ ...form, data: form.data }) });
      setDespesas((v) => [novo, ...v]);
      setForm({ ...form, descricao: '', valor: '', fornecedor: '', observacao: '' });
    } catch (e: any) {
      alert('Erro ao salvar no banco: ' + e.message);
    }
  };

  const alternarStatus = async (d: Despesa) => {
    if (d.status === 'Pago') {
      abrirEstorno(d);
      return;
    }
    if (d.status === 'Estornado') {
      alert('Esta despesa já está estornada.');
      return;
    }
    alert('Para pagar, selecione a despesa e use o botão Pagar. Assim você informa data, forma de pagamento e observação.');
  };

  const excluir = async (id: string) => {
    try {
      if (!confirm('Excluir despesa?')) return;
      await api(`/api/despesas/${id}`, { method: 'DELETE' });
      setDespesas((v) => v.filter((x) => x.id !== id));
      setSelecionadas((v) => v.filter((x) => x !== id));
    } catch (e: any) {
      alert('Erro ao excluir no banco: ' + e.message);
    }
  };

  const selecionarTodasComissoes = () => setSelecionadas(comissoesPendentesFiltradas.map((d) => d.id));
  const limparSelecao = () => setSelecionadas([]);
  const alternarSelecao = (id: string) =>
    setSelecionadas((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const pagarSelecionadas = async () => {
    try {
      if (!selecionadas.length) return alert('Selecione pelo menos uma despesa pendente.');
      if (!confirm(`Pagar ${selecionadas.length} despesa(s) no total de ${moeda(totalSelecionado)}?`)) return;

      const resp = await api('/api/despesas/pagar-lote', {
        method: 'POST',
        body: JSON.stringify({
          ids: selecionadas,
          forma: formaLote,
          dataPagamento: dataPagamentoLote,
          observacao: observacaoLote,
        }),
      });

      if (resp?.despesas) {
        setDespesas((v) => v.map((d) => resp.despesas.find((x: Despesa) => x.id === d.id) || d));
      } else {
        await carregar();
      }

      setSelecionadas([]);
      setObservacaoLote('');
      alert(`Despesas pagas. Lote: ${resp?.lotePagamento || 'gerado'}`);
    } catch (e: any) {
      alert('Erro ao pagar despesas: ' + e.message);
    }
  };

  const podeSelecionar = (d: Despesa) => d.status === 'Pendente' || d.status === 'Vencido';

  const abrirEstorno = (d: Despesa) => {
    if (d.status !== 'Pago') return;
    setModalEstorno(d);
    setMotivoEstorno('');
    setDataEstorno(new Date().toISOString().slice(0, 10));
  };

  const confirmarEstorno = async () => {
    try {
      if (!modalEstorno) return;
      if (!motivoEstorno.trim()) return alert('Informe o motivo do estorno.');

      const salvo = await api(`/api/despesas/${modalEstorno.id}/estornar`, {
        method: 'POST',
        body: JSON.stringify({ motivo: motivoEstorno, dataEstorno }),
      });

      setDespesas((v) => v.map((x) => (x.id === modalEstorno.id ? salvo : x)));
      setSelecionadas((v) => v.filter((id) => id !== modalEstorno.id));
      setModalEstorno(null);
      setMotivoEstorno('');
      alert('Despesa estornada e refletida no fluxo de caixa, financeiro e DRE.');
    } catch (e: any) {
      alert('Erro ao estornar despesa: ' + e.message);
    }
  };

  const limparFiltros = () =>
    setFiltros({
      dataInicio: '',
      dataFim: '',
      dataPagamentoInicio: '',
      dataPagamentoFim: '',
      categoria: 'Todas',
      status: 'Todos',
      profissional: 'Todos',
      forma: 'Todas',
    });

  return (
    <PageShell
      title="Despesas"
      subtitle="Contas a pagar, comissões, pagamentos em lote e estornos."
      actions={
        <Button onClick={salvar}>
          <Plus className="mr-1 h-4 w-4" /> Lançar
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <SummaryCard title="Pagas" value={moeda(resumo.pago)} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
          <SummaryCard title="Pendentes" value={moeda(resumo.pendente)} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
          <SummaryCard title="Vencidas" value={moeda(resumo.vencido)} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
          <SummaryCard title="Estornadas" value={moeda(resumo.estornado)} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
          <SummaryCard title="Comissões pendentes" value={moeda(resumo.comissaoPendente)} icon={<CreditCard className="h-5 w-5" />} tone="blue" />
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 font-bold">
            <Filter className="h-4 w-4" /> Filtros
          </div>
          <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
            <input type="date" className="rounded-xl border bg-background p-3" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
            <input type="date" className="rounded-xl border bg-background p-3" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
            <input type="date" className="rounded-xl border bg-background p-3" title="Data pagamento inicial" value={filtros.dataPagamentoInicio} onChange={(e) => setFiltros({ ...filtros, dataPagamentoInicio: e.target.value })} />
            <input type="date" className="rounded-xl border bg-background p-3" title="Data pagamento final" value={filtros.dataPagamentoFim} onChange={(e) => setFiltros({ ...filtros, dataPagamentoFim: e.target.value })} />
            <select className="rounded-xl border bg-background p-3" value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}>{categorias.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="rounded-xl border bg-background p-3" value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}><option>Todos</option><option>Pendente</option><option>Pago</option><option>Vencido</option><option>Estornado</option></select>
            <select className="rounded-xl border bg-background p-3" value={filtros.forma} onChange={(e) => setFiltros({ ...filtros, forma: e.target.value })}>{formasPagamento.map((f) => <option key={f}>{f}</option>)}</select>
            <select className="rounded-xl border bg-background p-3" value={filtros.profissional} onChange={(e) => setFiltros({ ...filtros, profissional: e.target.value })}>{profissionais.map((p) => <option key={p}>{p}</option>)}</select>
          </div>
          <Button variant="outline" className="mt-3" onClick={limparFiltros}>Limpar filtros</Button>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-bold">Pagamento de despesas</p>
              <p className="text-sm text-muted-foreground">Selecione despesas pendentes/vencidas e pague em um único lançamento no fluxo de caixa.</p>
              <p className="mt-1 text-sm font-semibold">Selecionadas: {selecionadas.length} • Total: {moeda(totalSelecionado)}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <select className="rounded-xl border bg-background p-3" value={formaLote} onChange={(e) => setFormaLote(e.target.value)}><option>Pix</option><option>Dinheiro</option><option>Transferência</option><option>Cartão</option></select>
              <input type="date" className="rounded-xl border bg-background p-3" value={dataPagamentoLote} onChange={(e) => setDataPagamentoLote(e.target.value)} />
              <input className="rounded-xl border bg-background p-3" placeholder="Observação" value={observacaoLote} onChange={(e) => setObservacaoLote(e.target.value)} />
              <Button variant="outline" onClick={() => setSelecionadas(despesasFiltradas.filter(podeSelecionar).map((d) => d.id))}><CheckSquare className="mr-1 h-4 w-4" />Todas</Button>
              <Button className="btn-premium" disabled={!selecionadas.length} onClick={pagarSelecionadas}><CreditCard className="mr-1 h-4 w-4" />Pagar</Button>
            </div>
          </div>
          {selecionadas.length > 0 && <Button variant="ghost" className="mt-2" onClick={limparSelecao}><Square className="mr-1 h-4 w-4" />Limpar seleção</Button>}
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="mb-3 font-bold">Nova despesa</p>
          <div className="grid gap-2 md:grid-cols-9">
            <input className="rounded-xl border bg-background p-3 md:col-span-2" placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            <select className="rounded-xl border bg-background p-3" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{['Aluguel','Energia','Água','Internet','Produtos','Manutenção','Salário','Comissão','Impostos','Marketing','Outros'].map((c) => <option key={c}>{c}</option>)}</select>
            <input type="number" className="rounded-xl border bg-background p-3" placeholder="Valor" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            <input type="date" className="rounded-xl border bg-background p-3" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            <select className="rounded-xl border bg-background p-3" value={form.forma} onChange={(e) => setForm({ ...form, forma: e.target.value })}><option>Pix</option><option>Dinheiro</option><option>Transferência</option><option>Débito</option><option>Crédito</option><option>Boleto</option><option>Cartão</option></select>
            <input className="rounded-xl border bg-background p-3" placeholder="Fornecedor/Profissional" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
            <select className="rounded-xl border bg-background p-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusDespesa })}><option>Pendente</option><option>Pago</option><option>Vencido</option><option>Estornado</option></select>
            <Button onClick={salvar}><Plus className="mr-1 h-4 w-4" />Lançar</Button>
          </div>
        </div>

        <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
          <table className="w-full text-sm">
            <thead><tr className="bg-secondary/60"><th className="p-4"></th><th className="p-4 text-left">Descrição</th><th className="p-4">Categoria</th><th className="p-4">Vencimento</th><th className="p-4">Pagamento</th><th className="p-4">Forma</th><th className="p-4">Prof./Fornecedor</th><th className="p-4">Status</th><th className="p-4 text-right">Valor</th><th className="p-4"></th></tr></thead>
            <tbody>
              {despesasFiltradas.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="p-4">{podeSelecionar(d) && <input type="checkbox" checked={selecionadas.includes(d.id)} onChange={() => alternarSelecao(d.id)} />}</td>
                  <td className="p-4 font-medium">{d.descricao}<p className="text-xs text-muted-foreground">{d.forma} {d.lotePagamento ? `• Lote ${d.lotePagamento}` : ''}</p></td>
                  <td className="p-4 text-center">{d.categoria}</td>
                  <td className="p-4 text-center">{dataBR(d.data)}</td>
                  <td className="p-4 text-center">{d.dataPagamento ? dataBR(d.dataPagamento) : '-'}</td>
                  <td className="p-4 text-center">{d.forma || '-'}</td>
                  <td className="p-4 text-center">{d.fornecedor}</td>
                  <td className="p-4 text-center"><button className="rounded-full bg-primary/15 px-3 py-1 text-primary" onClick={() => alternarStatus(d)}>{d.status}</button></td>
                  <td className="p-4 text-right font-bold text-red-500">{moeda(d.valor)}</td>
                  <td className="p-4 text-right"><Button size="icon" variant="outline" onClick={() => excluir(d.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
              {despesasFiltradas.length === 0 && <tr><td colSpan={10} className="p-10 text-center text-muted-foreground">Nenhuma despesa encontrada.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {despesasFiltradas.map((d) => (
            <div key={d.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex justify-between gap-3">
                <div className="flex gap-3">
                  {podeSelecionar(d) && <input type="checkbox" className="mt-1" checked={selecionadas.includes(d.id)} onChange={() => alternarSelecao(d.id)} />}
                  <div>
                    <p className="font-bold">{d.descricao}</p>
                    <p className="text-xs text-muted-foreground">{d.categoria} • {dataBR(d.data)} • {d.forma || 'Sem forma'} • {d.fornecedor || 'Sem fornecedor'}</p>
                    {d.dataPagamento && <p className="text-xs text-emerald-500">Pago em {dataBR(d.dataPagamento)} {d.lotePagamento ? `• ${d.lotePagamento}` : ''}</p>}
                    {d.status === 'Estornado' && <p className="text-xs text-red-500">Estornado{d.dataEstorno ? ` em ${dataBR(d.dataEstorno)}` : ''}{d.motivoEstorno ? ` • ${d.motivoEstorno}` : ''}</p>}
                  </div>
                </div>
                <p className="font-black text-red-500">{moeda(d.valor)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button className="rounded-full bg-primary/15 px-3 py-1 text-xs text-primary" onClick={() => alternarStatus(d)}>{d.status}</button>
                <Button size="sm" variant="outline" onClick={() => excluir(d.id)}><Trash2 className="mr-1 h-4 w-4" />Excluir</Button>
              </div>
            </div>
          ))}
          {despesasFiltradas.length === 0 && <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Nenhuma despesa encontrada.</div>}
        </div>
      </div>

        {modalEstorno && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-2xl border bg-card p-5 shadow-xl">
              <h2 className="text-xl font-black">Estornar despesa</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {modalEstorno.descricao} • {moeda(modalEstorno.valor)} • {modalEstorno.forma || 'Sem forma'}
              </p>

              <div className="mt-4 grid gap-3">
                <div>
                  <label className="text-sm font-semibold">Data do estorno</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border bg-background p-3"
                    value={dataEstorno}
                    onChange={(e) => setDataEstorno(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold">Motivo do estorno *</label>
                  <textarea
                    className="mt-1 min-h-28 w-full rounded-xl border bg-background p-3"
                    value={motivoEstorno}
                    onChange={(e) => setMotivoEstorno(e.target.value)}
                    placeholder="Ex.: pagamento lançado errado, fornecedor cancelou, duplicidade..."
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModalEstorno(null)}>Cancelar</Button>
                <Button className="btn-premium" onClick={confirmarEstorno}>Confirmar estorno</Button>
              </div>
            </div>
          </div>
        )}

    </PageShell>
  );
}
