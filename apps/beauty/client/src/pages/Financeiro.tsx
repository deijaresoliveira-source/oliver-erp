import { useBarbearia } from '@/contexts/BarbeariaContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowDownCircle, DollarSign, Filter, Scissors, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PageShell, SummaryCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useState } from 'react';

const moeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

type DespesaFinanceiro = { id: string; descricao: string; categoria: string; valor: number; data: string; dataPagamento?: string; forma: string; fornecedor: string; status: 'Pendente' | 'Pago' | 'Vencido'; lotePagamento?: string };
type MovimentoFluxo = { id: string; tipo: 'Entrada' | 'Saída'; descricao: string; categoria: string; valor: number; valorBruto?: number; taxaPercentual?: number; valorTaxa?: number; valorLiquido?: number; data: string; forma: string; status: 'Pago' | 'Pendente' };

async function api(path: string) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' } });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false) throw new Error(json?.error || 'Erro na API');
  return json?.data;
}

const dataInput = (data: string) => {
  if (!data) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [d, m, y] = data.split('/');
    return `${y}-${m}-${d}`;
  }
  return data.slice(0, 10);
};

const dentroPeriodo = (dataBrOuIso: string, inicio: string, fim: string) => {
  const iso = dataInput(dataBrOuIso);
  if (!iso) return true;
  if (inicio && iso < inicio) return false;
  if (fim && iso > fim) return false;
  return true;
};

function contem(item: any, termo: string) {
  return String(item?.categoria || item?.origem || item?.descricao || '').toLowerCase().includes(termo);
}
function ehComissao(item: any) { return contem(item, 'comiss'); }
function ehTaxaCartao(item: any) {
  const texto = String(`${item?.categoria || ''} ${item?.origem || ''} ${item?.descricao || ''}`).toLowerCase();
  return texto.includes('taxa') || texto.includes('cartao') || texto.includes('cartão') || texto.includes('maquininha') || texto.includes('operadora');
}
function ehProduto(item: any) { return contem(item, 'produto'); }
function ehAtendimento(item: any) {
  const texto = String(item?.categoria || item?.origem || item?.descricao || '').toLowerCase();
  return texto.includes('atendimento') || texto.includes('serviço') || texto.includes('servico');
}

function ehEstornoDespesa(item: any) {
  const texto = String(`${item?.categoria || ''} ${item?.origem || ''} ${item?.descricao || ''}`).toLowerCase();
  return texto.includes('estorno de despesa');
}

export default function Financeiro() {
  const { usuario, pode } = useAuth();
  const { agendamentos, profissionais, servicos } = useBarbearia() as any;
  const financeiroProprio = Boolean(
    usuario &&
    usuario.perfil !== 'Administrador' &&
    usuario.profissionalId &&
    (pode('financeiro.proprio.ver') || pode('financeiro.proprio.comissoes') || pode('financeiro.proprio.atendimentos'))
  );
  const profissionalDoUsuario = useMemo(
    () => profissionais.find((p: any) => String(p.id) === String(usuario?.profissionalId || '')),
    [profissionais, usuario?.profissionalId]
  );
  const nomeProfissionalProprio = profissionalDoUsuario?.nome || usuario?.profissionalNome || usuario?.profissionalApelido || '';
  const [despesas, setDespesas] = useState<DespesaFinanceiro[]>([]);
  const [fluxo, setFluxo] = useState<MovimentoFluxo[]>([]);
  const [filtros, setFiltros] = useState({ dataInicio: '', dataFim: '', profissional: 'Todos', categoria: 'Todas', status: 'Todos' });

  useEffect(() => {
    Promise.all([api('/api/despesas').catch(() => []), api('/api/fluxo-caixa').catch(() => [])]).then(([d, f]) => {
      setDespesas(d || []);
      setFluxo(f || []);
    });
  }, []);

  const profissionaisFiltro = useMemo(() => financeiroProprio ? [nomeProfissionalProprio || 'Meu financeiro'] : ['Todos', ...profissionais.map((p: any) => p.nome)], [financeiroProprio, nomeProfissionalProprio, profissionais]);

  const agendamentosFiltrados = useMemo(() => {
    return agendamentos.filter((a: any) => {
      if (!['Finalizado', 'Realizado'].includes(a.status)) return false;
      if (financeiroProprio && String(a.profissionalId) !== String(usuario?.profissionalId || '')) return false;
      if (!dentroPeriodo(a.data, filtros.dataInicio, filtros.dataFim)) return false;
      if (!financeiroProprio && filtros.profissional !== 'Todos' && a.profissionalNome !== filtros.profissional) return false;
      if (filtros.status !== 'Todos' && a.status !== filtros.status) return false;
      return true;
    });
  }, [agendamentos, filtros, financeiroProprio, usuario?.profissionalId]);

  const fluxoFiltrado = useMemo(() => {
    return fluxo.filter((m) => {
      if (!dentroPeriodo(m.data, filtros.dataInicio, filtros.dataFim)) return false;
      if (financeiroProprio) {
        const textoMov = `${m.descricao || ''} ${m.categoria || ''}`.toLowerCase();
        const nome = String(nomeProfissionalProprio || '').toLowerCase();
        if (nome && !textoMov.includes(nome)) return false;
      }
      if (filtros.status !== 'Todos' && m.status !== filtros.status) return false;
      if (filtros.categoria === 'Serviços' && !(ehAtendimento(m) && !ehProduto(m))) return false;
      if (filtros.categoria === 'Produtos' && !ehProduto(m)) return false;
      if (filtros.categoria === 'Comissões' && !ehComissao(m)) return false;
      if (filtros.categoria === 'Despesas' && (m.tipo !== 'Saída' || ehComissao(m))) return false;
      return true;
    });
  }, [fluxo, filtros, financeiroProprio, nomeProfissionalProprio]);

  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      const dataBase = d.status === 'Pago' && d.dataPagamento ? d.dataPagamento : d.data;
      if (!dentroPeriodo(dataBase, filtros.dataInicio, filtros.dataFim)) return false;
      if (financeiroProprio) {
        const nome = String(nomeProfissionalProprio || '').toLowerCase();
        const fornecedor = String(d.fornecedor || '').toLowerCase();
        if (d.categoria !== 'Comissão') return false;
        if (nome && fornecedor !== nome && !fornecedor.includes(nome)) return false;
      }
      if (filtros.status !== 'Todos' && d.status !== filtros.status) return false;
      if (!financeiroProprio && filtros.profissional !== 'Todos' && d.categoria === 'Comissão' && d.fornecedor !== filtros.profissional) return false;
      if (filtros.categoria === 'Comissões' && d.categoria !== 'Comissão') return false;
      if (filtros.categoria === 'Despesas' && (d.categoria === 'Comissão' || ehTaxaCartao(d))) return false;
      return true;
    });
  }, [despesas, filtros, financeiroProprio, nomeProfissionalProprio]);

  const entradasFluxo = fluxoFiltrado.filter((m) => m.tipo === 'Entrada' && m.status === 'Pago' && !ehEstornoDespesa(m));
  const saidasFluxo = fluxoFiltrado.filter((m) => m.tipo === 'Saída' && m.status === 'Pago');

  const receitaAtendimentosFluxo = entradasFluxo.filter((m) => ehAtendimento(m) && !ehProduto(m)).reduce((sum, m) => sum + Number(m.valor || 0), 0);
  const receitaProdutosFluxo = entradasFluxo.filter((m) => ehProduto(m)).reduce((sum, m) => sum + Number(m.valor || 0), 0);
  const receitaBrutaFluxo = entradasFluxo.reduce((sum, m) => sum + Number(m.valorBruto || m.valor || 0), 0);
  const taxasCartao = entradasFluxo.reduce((sum, m) => sum + Number(m.valorTaxa || 0), 0);
  const receitaFluxo = entradasFluxo.reduce((sum, m) => sum + Number(m.valorLiquido || m.valor || 0), 0);

  const receitaFallbackAgenda = agendamentosFiltrados.reduce((sum: number, a: any) => sum + Number(a.valor || 0), 0);
  const receita = receitaFluxo > 0 ? receitaFluxo : receitaFallbackAgenda;
  const receitaBruta = receitaBrutaFluxo > 0 ? receitaBrutaFluxo : receitaFallbackAgenda;
  const receitaServicos = receitaAtendimentosFluxo > 0 ? receitaAtendimentosFluxo : receitaFallbackAgenda;
  const receitaProdutos = receitaProdutosFluxo;

  const comissoesPagasDespesa = despesasFiltradas.filter((d) => d.status === 'Pago' && d.categoria === 'Comissão').reduce((sum, d) => sum + Number(d.valor || 0), 0);
  const comissoesPagasFluxo = saidasFluxo.filter((m) => ehComissao(m)).reduce((sum, m) => sum + Number(m.valor || 0), 0);
  const totalComissoes = comissoesPagasDespesa > 0 ? comissoesPagasDespesa : comissoesPagasFluxo;

  const outrasDespesas = despesasFiltradas
    .filter((d) => d.status === 'Pago' && d.categoria !== 'Comissão' && !ehTaxaCartao(d))
    .reduce((sum, d) => sum + Number(d.valor || 0), 0);
  const lucro = receita - totalComissoes - outrasDespesas;
  const ticketMedio = agendamentosFiltrados.length ? receita / agendamentosFiltrados.length : 0;

  const receitaPorServico = servicos
    .map((servico: any) => ({
      name: servico.nome,
      value: agendamentosFiltrados.filter((a: any) => String(a.servicoId) === String(servico.id)).reduce((s: number, a: any) => s + Number(a.valor || 0), 0),
    }))
    .filter((s: any) => s.value > 0);

  const comissaoPorProfissional = profissionais
    .map((prof: any) => {
      const nome = String(prof.nome || '');
      const comissoesDespesa = despesasFiltradas.filter((d) => d.categoria === 'Comissão' && d.fornecedor === nome && dentroPeriodo(d.status === 'Pago' && d.dataPagamento ? d.dataPagamento : d.data, filtros.dataInicio, filtros.dataFim));
      const pendente = comissoesDespesa.filter((d) => d.status === 'Pendente').reduce((s, d) => s + Number(d.valor || 0), 0);
      const paga = comissoesDespesa.filter((d) => d.status === 'Pago').reduce((s, d) => s + Number(d.valor || 0), 0);
      const atendimentos = agendamentosFiltrados.filter((a: any) => String(a.profissionalId) === String(prof.id));
      const receitaProfissional = atendimentos.reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
      return { name: nome, receita: receitaProfissional, comissaoPendente: pendente, comissaoPaga: paga, atendimentos: atendimentos.length };
    })
    .filter((p: any) => p.receita > 0 || p.comissaoPendente > 0 || p.comissaoPaga > 0);

  const limparFiltros = () => setFiltros({ dataInicio: '', dataFim: '', profissional: financeiroProprio ? (nomeProfissionalProprio || 'Todos') : 'Todos', categoria: 'Todas', status: 'Todos' });

  return (
    <PageShell title={financeiroProprio ? "Meu Financeiro" : "Financeiro"} subtitle={financeiroProprio ? "Resumo dos seus atendimentos, faturamento e comissões." : "Resumo gerencial com filtros por período, profissional, categoria e status."}>
      <div className="space-y-5">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 font-bold"><Filter className="h-4 w-4" />Filtros</div>
          <div className="grid gap-2 md:grid-cols-5">
            <input type="date" className="rounded-xl border bg-background p-3" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
            <input type="date" className="rounded-xl border bg-background p-3" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
            <select className="rounded-xl border bg-background p-3" value={financeiroProprio ? (nomeProfissionalProprio || profissionaisFiltro[0]) : filtros.profissional} disabled={financeiroProprio} onChange={(e) => setFiltros({ ...filtros, profissional: e.target.value })}>{profissionaisFiltro.map((p: string) => <option key={p}>{p}</option>)}</select>
            <select className="rounded-xl border bg-background p-3" value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}><option>Todas</option><option>Serviços</option><option>Produtos</option><option>Comissões</option><option>Despesas</option></select>
            <select className="rounded-xl border bg-background p-3" value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}><option>Todos</option><option>Pago</option><option>Pendente</option><option>Realizado</option><option>Finalizado</option></select>
          </div>
          <Button variant="outline" className="mt-3" onClick={limparFiltros}>Limpar filtros</Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard title="Receita bruta" value={moeda(receitaBruta)} icon={<DollarSign className="h-5 w-5" />} tone="green" />
          <SummaryCard title="Receita serviços" value={moeda(receitaServicos)} icon={<Scissors className="h-5 w-5" />} tone="blue" />
          <SummaryCard title="Receita produtos" value={moeda(receitaProdutos)} icon={<DollarSign className="h-5 w-5" />} tone="primary" />
          <SummaryCard title="Comissões pagas" value={moeda(totalComissoes)} icon={<Users className="h-5 w-5" />} tone="amber" />
          <SummaryCard title="Outras despesas" value={moeda(outrasDespesas)} icon={<ArrowDownCircle className="h-5 w-5" />} tone="red" />
          <SummaryCard title="Lucro estimado" value={moeda(lucro)} icon={<TrendingUp className="h-5 w-5" />} tone="primary" />
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <b>Regra:</b> produtos não geram comissão. Comissão fica separada das demais despesas. Se estiver registrada em Despesas e Fluxo, a tela usa uma única origem para evitar duplicidade.
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
            <h2 className="mb-4 text-lg font-bold">Receita por serviço pago</h2>
            {receitaPorServico.length ? (
              <div className="h-[260px] md:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={receitaPorServico} margin={{ left: 0, right: 8, top: 8, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={-25} textAnchor="end" height={70} interval={0} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => moeda(Number(v))} /><Bar dataKey="value" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="py-10 text-center text-muted-foreground">Nenhum pagamento concluído.</p>}
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
            <h2 className="mb-4 text-lg font-bold">Comissões por profissional</h2>
            <div className="space-y-3">
              {comissaoPorProfissional.map((p: any) => (
                <div key={p.name} className="rounded-2xl border bg-secondary/40 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{p.name}</p><p className="text-xs text-muted-foreground">{p.atendimentos} atendimento(s) pago(s)</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Paga</p><p className="font-black text-emerald-500">{moeda(p.comissaoPaga)}</p><p className="mt-1 text-xs text-amber-500">Pendente {moeda(p.comissaoPendente)}</p></div></div>
                </div>
              ))}
              {!comissaoPorProfissional.length && <p className="py-10 text-center text-muted-foreground">Nenhuma comissão registrada.</p>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Resumo operacional</h2>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3"><div className="rounded-xl bg-secondary/50 p-3"><p className="text-muted-foreground">Ticket médio</p><p className="text-xl font-black">{moeda(ticketMedio)}</p></div><div className="rounded-xl bg-secondary/50 p-3"><p className="text-muted-foreground">Comissões pagas</p><p className="text-xl font-black text-amber-500">{moeda(totalComissoes)}</p></div><div className="rounded-xl bg-secondary/50 p-3"><p className="text-muted-foreground">Lucro estimado</p><p className="text-xl font-black text-primary">{moeda(lucro)}</p></div></div>
        </div>
      </div>
    </PageShell>
  );
}
