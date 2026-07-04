import { useBarbearia } from '@/contexts/BarbeariaContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  DollarSign,
  FileDown,
  Package,
  Printer,
  Scissors,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageShell, SummaryCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type RelatorioTipo = 'central' | 'resumo' | 'clientes' | 'profissionais' | 'financeiro' | 'estoque' | 'agenda';

type Despesa = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  dataPagamento?: string;
  forma: string;
  fornecedor: string;
  status: 'Pendente' | 'Pago' | 'Vencido' | string;
  observacao?: string;
};

type Movimento = {
  id: string;
  tipo: 'Entrada' | 'Saída' | string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  forma: string;
  status: 'Pago' | 'Pendente' | string;
};

type Produto = {
  id: string;
  nome: string;
  categoria?: string;
  estoqueAtual?: number;
  estoqueMinimo?: number;
  precoCusto?: number;
  precoVenda?: number;
  ativo?: boolean;
};

const moeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));

function dataParaISO(data: string) {
  if (!data) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [d, m, y] = data.split('/');
    return `${y}-${m}-${d}`;
  }
  return String(data).slice(0, 10);
}

function dataBR(data: string) {
  const iso = dataParaISO(data);
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function dentroPeriodo(data: string, inicio: string, fim: string) {
  const iso = dataParaISO(data);
  if (!iso) return true;
  if (inicio && iso < inicio) return false;
  if (fim && iso > fim) return false;
  return true;
}

function ehRealizado(status: string) {
  return ['Realizado', 'Finalizado'].includes(String(status || ''));
}

function ehCancelado(status: string) {
  return ['Cancelado'].includes(String(status || ''));
}

function ehFalta(status: string) {
  return ['Faltou'].includes(String(status || ''));
}

function ehComissao(item: any) {
  return String(item?.categoria || item?.origem || item?.descricao || '')
    .toLowerCase()
    .includes('comiss');
}

function ehProduto(item: any) {
  return String(item?.categoria || item?.origem || item?.descricao || '')
    .toLowerCase()
    .includes('produto');
}

function texto(item: any) {
  return Object.values(item || {}).join(' ').toLowerCase();
}

async function api(path: string) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' } });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false) throw new Error(json?.error || 'Erro na API');
  return json?.data || json || [];
}

function tabelaParaCSV(linhas: any[], colunas: { key: string; label: string }[]) {
  const cabecalho = colunas.map((c) => `"${c.label}"`).join(';');
  const corpo = linhas.map((linha) =>
    colunas
      .map((c) => {
        const valor = linha[c.key] ?? '';
        return `"${String(valor).replace(/"/g, '""')}"`;
      })
      .join(';')
  );
  return [cabecalho, ...corpo].join('\n');
}

function baixarCSV(nome: string, linhas: any[], colunas: { key: string; label: string }[]) {
  const csv = tabelaParaCSV(linhas, colunas);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function imprimir() {
  window.print();
}

function Tabela({
  colunas,
  linhas,
  vazio = 'Nenhum registro encontrado.',
}: {
  colunas: { key: string; label: string; align?: 'left' | 'right' | 'center' }[];
  linhas: any[];
  vazio?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/60">
            <tr>
              {colunas.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 font-black ${
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={colunas.length}>
                  {vazio}
                </td>
              </tr>
            ) : (
              linhas.map((linha, idx) => (
                <tr key={linha.id || idx} className="border-t hover:bg-muted/30">
                  {colunas.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3 ${
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {linha[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardRelatorio({
  icon,
  titulo,
  descricao,
  onClick,
}: {
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-black">{titulo}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{descricao}</p>
      <p className="mt-4 text-sm font-bold text-primary">Abrir relatório →</p>
    </button>
  );
}

export default function Relatorios() {
  const { usuario, pode } = useAuth();
  const { agendamentos, clientes, profissionais, servicos, produtos: produtosContexto } = useBarbearia() as any;

  const hoje = new Date().toISOString().slice(0, 10);
  const primeiroDia = hoje.slice(0, 8) + '01';

  const [tipo, setTipo] = useState<RelatorioTipo>('central');
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState({
    inicio: primeiroDia,
    fim: hoje,
    profissionalId: 'todos',
    clienteId: 'todos',
    status: 'todos',
  });

  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [fluxo, setFluxo] = useState<Movimento[]>([]);
  const [produtosServidor, setProdutosServidor] = useState<Produto[]>([]);

  const financeiroProprio = Boolean(
    usuario &&
      usuario.perfil !== 'Administrador' &&
      usuario.profissionalId &&
      (pode('financeiro.proprio.ver') || pode('financeiro.proprio.comissoes') || pode('financeiro.proprio.atendimentos')) &&
      !pode('relatorios.ver')
  );

  const clientesProprios = Boolean(
    usuario && usuario.perfil !== 'Administrador' && usuario.profissionalId && pode('clientes.proprio.ver') && !pode('clientes.ver')
  );

  const profissionalLogadoId = String(usuario?.profissionalId || '');

  useEffect(() => {
    Promise.all([
      api('/api/despesas').catch(() => []),
      api('/api/fluxo-caixa').catch(() => []),
      api('/api/produtos').catch(() => []),
    ]).then(([d, f, p]) => {
      setDespesas(Array.isArray(d) ? d : []);
      setFluxo(Array.isArray(f) ? f : []);
      setProdutosServidor(Array.isArray(p) ? p : []);
    });
  }, []);

  useEffect(() => {
    if ((financeiroProprio || clientesProprios) && profissionalLogadoId) {
      setFiltros((atual) => ({ ...atual, profissionalId: profissionalLogadoId }));
    }
  }, [financeiroProprio, clientesProprios, profissionalLogadoId]);

  const produtos = produtosServidor.length ? produtosServidor : produtosContexto || [];

  const profissionalDoUsuario = profissionais.find((p: any) => String(p.id) === profissionalLogadoId);
  const nomeProfissionalUsuario = String(
    profissionalDoUsuario?.nome || usuario?.profissionalNome || usuario?.profissionalApelido || ''
  ).trim();

  const agendamentosBase = useMemo(() => {
    return (agendamentos || []).filter((a: any) => {
      if (!dentroPeriodo(a.data, filtros.inicio, filtros.fim)) return false;
      if ((financeiroProprio || clientesProprios) && String(a.profissionalId) !== profissionalLogadoId) return false;
      if (!financeiroProprio && !clientesProprios && filtros.profissionalId !== 'todos' && String(a.profissionalId) !== filtros.profissionalId) return false;
      if (filtros.clienteId !== 'todos' && String(a.clienteId) !== filtros.clienteId) return false;
      if (filtros.status !== 'todos' && String(a.status) !== filtros.status) return false;
      if (busca && !texto(a).includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [agendamentos, filtros, busca, financeiroProprio, clientesProprios, profissionalLogadoId]);

  const realizados = agendamentosBase.filter((a: any) => ehRealizado(a.status));
  const agendados = agendamentosBase.filter((a: any) => !ehRealizado(a.status) && !ehCancelado(a.status) && !ehFalta(a.status));
  const cancelados = agendamentosBase.filter((a: any) => ehCancelado(a.status));
  const faltas = agendamentosBase.filter((a: any) => ehFalta(a.status));

  const despesasBase = useMemo(() => {
    return (despesas || []).filter((d) => {
      const dataBase = d.status === 'Pago' && d.dataPagamento ? d.dataPagamento : d.data;
      if (!dentroPeriodo(dataBase, filtros.inicio, filtros.fim)) return false;
      if (financeiroProprio) {
        const nome = nomeProfissionalUsuario.toLowerCase();
        const conteudo = `${d.fornecedor || ''} ${d.descricao || ''} ${d.observacao || ''}`.toLowerCase();
        if (!ehComissao(d)) return false;
        if (nome && !conteudo.includes(nome)) return false;
      }
      if (busca && !texto(d).includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [despesas, filtros, busca, financeiroProprio, nomeProfissionalUsuario]);

  const fluxoBase = useMemo(() => {
    return (fluxo || []).filter((m) => {
      if (!dentroPeriodo(m.data, filtros.inicio, filtros.fim)) return false;
      if (financeiroProprio) {
        const nome = nomeProfissionalUsuario.toLowerCase();
        const conteudo = `${m.descricao || ''} ${m.categoria || ''}`.toLowerCase();
        if (nome && !conteudo.includes(nome)) return false;
      }
      if (busca && !texto(m).includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [fluxo, filtros, busca, financeiroProprio, nomeProfissionalUsuario]);

  const receitaAtendimentos = realizados.reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
  const entradas = fluxoBase.filter((m) => m.tipo === 'Entrada' && m.status === 'Pago');
  const saidas = fluxoBase.filter((m) => m.tipo === 'Saída' && m.status === 'Pago');
  const receitasFluxo = entradas.reduce((s, m) => s + Number(m.valor || 0), 0);
  const receitaProdutos = entradas.filter(ehProduto).reduce((s, m) => s + Number(m.valor || 0), 0);
  const receitaServicos = receitasFluxo ? entradas.filter((m) => !ehProduto(m)).reduce((s, m) => s + Number(m.valor || 0), 0) : receitaAtendimentos;

  const comissoesPagas = despesasBase.filter((d) => d.status === 'Pago' && ehComissao(d)).reduce((s, d) => s + Number(d.valor || 0), 0);
  const comissoesPendentes = despesasBase.filter((d) => d.status !== 'Pago' && ehComissao(d)).reduce((s, d) => s + Number(d.valor || 0), 0);
  const despesasPagas = despesasBase.filter((d) => d.status === 'Pago' && !ehComissao(d)).reduce((s, d) => s + Number(d.valor || 0), 0);
  const lucro = receitaServicos + receitaProdutos - despesasPagas - comissoesPagas;
  const ticketMedio = realizados.length ? receitaAtendimentos / realizados.length : 0;

  const clientesRelatorio = useMemo(() => {
    return (clientes || [])
      .map((c: any) => {
        const ats = agendamentosBase.filter((a: any) => String(a.clienteId) === String(c.id));
        const ult = ats
          .map((a: any) => dataParaISO(a.data))
          .filter(Boolean)
          .sort()
          .at(-1);
        const gasto = ats.filter((a: any) => ehRealizado(a.status)).reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
        return {
          id: String(c.id),
          cliente: c.nome || c.clienteNome || '',
          telefone: c.telefone || c.telefonCliente || '',
          status: c.status || 'Ativo',
          ultimoAtendimento: ult ? dataBR(ult) : '-',
          atendimentos: ats.filter((a: any) => ehRealizado(a.status)).length,
          valorGasto: moeda(gasto),
          valorGastoNumero: gasto,
        };
      })
      .filter((c: any) => {
        if (busca && !texto(c).includes(busca.toLowerCase())) return false;
        if ((clientesProprios || financeiroProprio) && c.atendimentos === 0) return false;
        return true;
      })
      .sort((a: any, b: any) => b.valorGastoNumero - a.valorGastoNumero);
  }, [clientes, agendamentosBase, busca, clientesProprios, financeiroProprio]);

  const profissionaisRelatorio = useMemo(() => {
    return (profissionais || [])
      .filter((p: any) => {
        if ((financeiroProprio || clientesProprios) && String(p.id) !== profissionalLogadoId) return false;
        if (filtros.profissionalId !== 'todos' && String(p.id) !== filtros.profissionalId) return false;
        if (busca && !texto(p).includes(busca.toLowerCase())) return false;
        return true;
      })
      .map((p: any) => {
        const ats = agendamentosBase.filter((a: any) => String(a.profissionalId) === String(p.id) && ehRealizado(a.status));
        const receita = ats.reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
        const meta = Number(p.metaMensal || 0);
        const percentualMeta = meta ? Math.round((receita / meta) * 100) : 0;
        const comissaoGerada = receita * (Number(p.comissao || 0) / 100);
        const nome = String(p.nome || '').toLowerCase();
        const comissoesDoProf = despesasBase.filter((d) => ehComissao(d) && `${d.fornecedor} ${d.descricao}`.toLowerCase().includes(nome));
        const comissaoPaga = comissoesDoProf.filter((d) => d.status === 'Pago').reduce((s, d) => s + Number(d.valor || 0), 0);
        const comissaoPendente = comissoesDoProf.filter((d) => d.status !== 'Pago').reduce((s, d) => s + Number(d.valor || 0), 0);

        return {
          id: String(p.id),
          profissional: p.apelido || p.nome,
          atendimentos: ats.length,
          receita: moeda(receita),
          comissaoGerada: moeda(comissaoGerada),
          comissaoPaga: moeda(comissaoPaga),
          comissaoPendente: moeda(comissaoPendente || Math.max(0, comissaoGerada - comissaoPaga)),
          meta: moeda(meta),
          percentualMeta: `${percentualMeta}%`,
          ticketMedio: moeda(ats.length ? receita / ats.length : 0),
          receitaNumero: receita,
        };
      })
      .sort((a: any, b: any) => b.receitaNumero - a.receitaNumero);
  }, [profissionais, agendamentosBase, despesasBase, filtros.profissionalId, busca, financeiroProprio, clientesProprios, profissionalLogadoId]);

  const financeiroLinhas = [
    { id: 'receita-servicos', indicador: 'Receita de serviços', valor: moeda(receitaServicos), situacao: 'Receita' },
    { id: 'receita-produtos', indicador: 'Receita de produtos', valor: moeda(receitaProdutos), situacao: 'Receita' },
    { id: 'despesas-pagas', indicador: 'Despesas pagas', valor: moeda(despesasPagas), situacao: 'Despesa' },
    { id: 'comissoes-pagas', indicador: 'Comissões pagas', valor: moeda(comissoesPagas), situacao: 'Despesa' },
    { id: 'comissoes-pendentes', indicador: 'Comissões pendentes', valor: moeda(comissoesPendentes), situacao: 'Pendente' },
    { id: 'lucro', indicador: 'Lucro do período', valor: moeda(lucro), situacao: lucro >= 0 ? 'Positivo' : 'Negativo' },
  ];

  const estoqueLinhas = (produtos || [])
    .filter((p: any) => !busca || texto(p).includes(busca.toLowerCase()))
    .map((p: any) => {
      const atual = Number(p.estoqueAtual ?? p.estoque_atual ?? 0);
      const minimo = Number(p.estoqueMinimo ?? p.estoque_minimo ?? 0);
      const custo = Number(p.precoCusto ?? p.preco_custo ?? 0);
      return {
        id: String(p.id),
        produto: p.nome,
        categoria: p.categoria || '-',
        estoqueAtual: atual,
        estoqueMinimo: minimo,
        situacao: atual <= minimo ? 'Abaixo do mínimo' : 'OK',
        valorUnitario: moeda(custo),
        valorTotal: moeda(atual * custo),
        valorTotalNumero: atual * custo,
      };
    })
    .sort((a: any, b: any) => a.situacao.localeCompare(b.situacao));

  const agendaLinhas = agendamentosBase
    .map((a: any) => ({
      id: String(a.id),
      data: dataBR(a.data),
      hora: a.hora || '',
      cliente: a.clienteNome || '',
      profissional: a.profissionalNome || '',
      servico: a.servicoNome || '',
      status: a.status || '',
      valor: moeda(Number(a.valor || 0)),
    }))
    .sort((a: any, b: any) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));

  const relatorioAtual = {
    resumo: {
      nome: 'Resumo Geral',
      colunas: [
        { key: 'indicador', label: 'Indicador' },
        { key: 'valor', label: 'Valor', align: 'right' as const },
        { key: 'situacao', label: 'Situação' },
      ],
      linhas: [
        { id: 'receita', indicador: 'Receita do período', valor: moeda(receitaServicos + receitaProdutos), situacao: 'Receita' },
        { id: 'despesas', indicador: 'Despesas do período', valor: moeda(despesasPagas + comissoesPagas), situacao: 'Despesa' },
        { id: 'lucro', indicador: 'Lucro do período', valor: moeda(lucro), situacao: lucro >= 0 ? 'Positivo' : 'Negativo' },
        { id: 'agendamentos', indicador: 'Agendamentos', valor: agendamentosBase.length, situacao: 'Total' },
        { id: 'atendimentos', indicador: 'Atendimentos realizados', valor: realizados.length, situacao: 'Realizados' },
        { id: 'ticket', indicador: 'Ticket médio', valor: moeda(ticketMedio), situacao: 'Média' },
        { id: 'comissoes-pagas', indicador: 'Comissões pagas', valor: moeda(comissoesPagas), situacao: 'Pago' },
        { id: 'comissoes-pendentes', indicador: 'Comissões pendentes', valor: moeda(comissoesPendentes), situacao: 'Pendente' },
      ],
    },
    clientes: {
      nome: 'Clientes',
      colunas: [
        { key: 'cliente', label: 'Cliente' },
        { key: 'telefone', label: 'Telefone' },
        { key: 'status', label: 'Status' },
        { key: 'ultimoAtendimento', label: 'Último atendimento' },
        { key: 'atendimentos', label: 'Atendimentos', align: 'center' as const },
        { key: 'valorGasto', label: 'Valor gasto', align: 'right' as const },
      ],
      linhas: clientesRelatorio,
    },
    profissionais: {
      nome: 'Profissionais',
      colunas: [
        { key: 'profissional', label: 'Profissional' },
        { key: 'atendimentos', label: 'Atendimentos', align: 'center' as const },
        { key: 'receita', label: 'Receita', align: 'right' as const },
        { key: 'comissaoGerada', label: 'Comissão gerada', align: 'right' as const },
        { key: 'comissaoPaga', label: 'Comissão paga', align: 'right' as const },
        { key: 'comissaoPendente', label: 'Comissão pendente', align: 'right' as const },
        { key: 'meta', label: 'Meta', align: 'right' as const },
        { key: 'percentualMeta', label: '% Meta', align: 'center' as const },
        { key: 'ticketMedio', label: 'Ticket médio', align: 'right' as const },
      ],
      linhas: profissionaisRelatorio,
    },
    financeiro: {
      nome: 'Financeiro',
      colunas: [
        { key: 'indicador', label: 'Indicador' },
        { key: 'valor', label: 'Valor', align: 'right' as const },
        { key: 'situacao', label: 'Situação' },
      ],
      linhas: financeiroLinhas,
    },
    estoque: {
      nome: 'Estoque',
      colunas: [
        { key: 'produto', label: 'Produto' },
        { key: 'categoria', label: 'Categoria' },
        { key: 'estoqueAtual', label: 'Atual', align: 'center' as const },
        { key: 'estoqueMinimo', label: 'Mínimo', align: 'center' as const },
        { key: 'situacao', label: 'Situação' },
        { key: 'valorUnitario', label: 'Valor unitário', align: 'right' as const },
        { key: 'valorTotal', label: 'Valor total', align: 'right' as const },
      ],
      linhas: estoqueLinhas,
    },
    agenda: {
      nome: 'Agenda e Produtividade',
      colunas: [
        { key: 'data', label: 'Data' },
        { key: 'hora', label: 'Hora' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'profissional', label: 'Profissional' },
        { key: 'servico', label: 'Serviço' },
        { key: 'status', label: 'Status' },
        { key: 'valor', label: 'Valor', align: 'right' as const },
      ],
      linhas: agendaLinhas,
    },
  } as const;

  const relatorioSelecionado = tipo !== 'central' ? relatorioAtual[tipo] : null;

  const limparFiltros = () =>
    setFiltros({
      inicio: primeiroDia,
      fim: hoje,
      profissionalId: (financeiroProprio || clientesProprios) && profissionalLogadoId ? profissionalLogadoId : 'todos',
      clienteId: 'todos',
      status: 'todos',
    });

  const exportarAtual = () => {
    if (!relatorioSelecionado) return;
    baixarCSV(
      `relatorio-${relatorioSelecionado.nome.toLowerCase().replace(/\s+/g, '-')}.csv`,
      relatorioSelecionado.linhas as any[],
      relatorioSelecionado.colunas as any[]
    );
  };

  const subtitulo = financeiroProprio
    ? 'Relatórios limitados ao profissional vinculado ao usuário logado.'
    : 'Central com os principais relatórios administrativos da empresa, sem gráficos.';

  return (
    <PageShell
      title={tipo === 'central' ? 'Relatórios' : relatorioSelecionado?.nome || 'Relatórios'}
      subtitle={subtitulo}
      actions={
        tipo !== 'central' ? (
          <>
            <Button variant="outline" onClick={() => setTipo('central')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button variant="outline" onClick={exportarAtual} className="gap-2">
              <FileDown className="h-4 w-4" />
              Excel/CSV
            </Button>
            <Button variant="outline" onClick={imprimir} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {financeiroProprio && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            <b>Acesso restrito:</b> este usuário está visualizando somente os dados do profissional{' '}
            <b>{nomeProfissionalUsuario || 'vinculado'}</b>.
          </div>
        )}

        {tipo === 'central' ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CardRelatorio
              icon={<TrendingUp className="h-6 w-6" />}
              titulo="Resumo Geral"
              descricao="Receita, despesas, lucro, atendimentos, ticket médio e comissões."
              onClick={() => setTipo('resumo')}
            />
            <CardRelatorio
              icon={<Users className="h-6 w-6" />}
              titulo="Clientes"
              descricao="Clientes ativos, últimos atendimentos, quantidade de visitas e valor gasto."
              onClick={() => setTipo('clientes')}
            />
            <CardRelatorio
              icon={<Scissors className="h-6 w-6" />}
              titulo="Profissionais"
              descricao="Atendimentos, receita, comissões, meta mensal e ticket médio por profissional."
              onClick={() => setTipo('profissionais')}
            />
            <CardRelatorio
              icon={<DollarSign className="h-6 w-6" />}
              titulo="Financeiro"
              descricao="Receitas, despesas, lucro, comissões pagas e comissões pendentes."
              onClick={() => setTipo('financeiro')}
            />
            <CardRelatorio
              icon={<Package className="h-6 w-6" />}
              titulo="Estoque"
              descricao="Produtos, estoque atual, mínimo, situação e valor total em estoque."
              onClick={() => setTipo('estoque')}
            />
            <CardRelatorio
              icon={<CalendarDays className="h-6 w-6" />}
              titulo="Agenda e Produtividade"
              descricao="Agendamentos, atendimentos, cancelamentos, faltas e produtividade."
              onClick={() => setTipo('agenda')}
            />
          </div>
        ) : (
          <>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="mb-3 font-black">Filtros</p>
              <div className="grid gap-3 md:grid-cols-6">
                <div>
                  <Label>Data inicial</Label>
                  <Input type="date" value={filtros.inicio} onChange={(e) => setFiltros({ ...filtros, inicio: e.target.value })} />
                </div>
                <div>
                  <Label>Data final</Label>
                  <Input type="date" value={filtros.fim} onChange={(e) => setFiltros({ ...filtros, fim: e.target.value })} />
                </div>
                <div>
                  <Label>Profissional</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={filtros.profissionalId}
                    disabled={financeiroProprio || clientesProprios}
                    onChange={(e) => setFiltros({ ...filtros, profissionalId: e.target.value })}
                  >
                    <option value="todos">Todos</option>
                    {profissionais.map((p: any) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.apelido || p.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Cliente</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={filtros.clienteId}
                    onChange={(e) => setFiltros({ ...filtros, clienteId: e.target.value })}
                  >
                    <option value="todos">Todos</option>
                    {clientes.map((c: any) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={filtros.status}
                    onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
                  >
                    <option value="todos">Todos</option>
                    <option value="Agendado">Agendado</option>
                    <option value="Solicitado">Solicitado</option>
                    <option value="Confirmado">Confirmado</option>
                    <option value="Realizado">Realizado</option>
                    <option value="Finalizado">Finalizado</option>
                    <option value="Cancelado">Cancelado</option>
                    <option value="Faltou">Faltou</option>
                  </select>
                </div>
                <div>
                  <Label>Pesquisar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." />
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <SummaryCard title="Receita" value={moeda(receitaServicos + receitaProdutos)} icon={<DollarSign className="h-5 w-5" />} tone="green" />
              <SummaryCard title="Despesas" value={moeda(despesasPagas + comissoesPagas)} icon={<AlertCircle className="h-5 w-5" />} tone="red" />
              <SummaryCard title="Lucro" value={moeda(lucro)} icon={<TrendingUp className="h-5 w-5" />} tone={lucro >= 0 ? 'blue' : 'red'} />
              <SummaryCard title="Atendimentos" value={realizados.length} icon={<ClipboardList className="h-5 w-5" />} tone="primary" />
            </div>

            <Tabela
              colunas={relatorioSelecionado!.colunas as any[]}
              linhas={relatorioSelecionado!.linhas as any[]}
              vazio="Nenhum registro encontrado para os filtros selecionados."
            />
          </>
        )}
      </div>
    </PageShell>
  );
}
