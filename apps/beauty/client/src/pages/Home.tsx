import { Button } from '@/components/ui/button';
import { useBarbearia } from '@/contexts/BarbeariaContext';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ClipboardList,
  DollarSign,
  MessageCircle,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';


function dataParaISO(data: string) {
  if (!data) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const partes = data.split('/');
  if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
  return data;
}

function formatarDataBR(data: Date) {
  return data.toLocaleDateString('pt-BR');
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}


function telefoneParaWhatsApp(telefone: string) {
  const numero = String(telefone || '').replace(/\D/g, '');
  if (!numero) return '';
  return numero.startsWith('55') ? numero : `55${numero}`;
}

function abrirWhatsapp(telefone: string, mensagem: string) {
  const numero = telefoneParaWhatsApp(telefone);
  if (!numero) return;
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, '_blank');
}

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error || 'Erro na API');
  }
  return json?.data;
}

type SolicitacaoAgendamento = {
  id: string;
  nomeCliente: string;
  telefone: string;
  servicoNome: string;
  servicos?: { id: string; nome: string; valor?: number; duracao?: string; duracaoMinutos?: number }[];
  profissionalNome: string;
  data: string;
  dataISO?: string;
  hora: string;
  valor: number;
  status: string;
};

function StatusBadge({ status }: { status: string }) {
  const confirmado = status.toLowerCase() === 'confirmado';
  return (
    <span className={`rounded-lg px-3 py-1 text-sm ${confirmado ? 'bg-emerald-500/15 text-emerald-300' : 'bg-violet-500/20 text-violet-200'}`}>
      {status}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, link, linkPath, colorClass }: any) {
  const conteudo = (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-6 shadow-2xl shadow-black/20 backdrop-blur transition hover:border-[#f6b21a]/50 hover:bg-white/[0.09]">
      <div className="flex items-start gap-5">
        <div className={`grid h-13 w-13 place-items-center rounded-xl ${colorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-base text-slate-100">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
          <p className="mt-5 inline-flex items-center gap-2 text-slate-300">
            {link} <ArrowRight className="h-4 w-4" />
          </p>
        </div>
      </div>
    </div>
  );

  return linkPath ? <Link href={linkPath}>{conteudo}</Link> : conteudo;
}

function CalendarMini({ selecionada, onSelecionar, datasComAgenda }: { selecionada: Date; onSelecionar: (data: Date) => void; datasComAgenda: Set<string> }) {
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const [mesAtual, setMesAtual] = useState(new Date(selecionada.getFullYear(), selecionada.getMonth(), 1));

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const primeiroDia = new Date(ano, mes, 1);
  const inicioGrade = new Date(primeiroDia);
  inicioGrade.setDate(primeiroDia.getDate() - primeiroDia.getDay());

  const diasGrade = Array.from({ length: 42 }, (_, i) => {
    const data = new Date(inicioGrade);
    data.setDate(inicioGrade.getDate() + i);
    return data;
  });

  const voltarMes = () => setMesAtual(new Date(ano, mes - 1, 1));
  const avancarMes = () => setMesAtual(new Date(ano, mes + 1, 1));
  const selecionadaISO = selecionada.toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-6 shadow-2xl shadow-black/20">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Calendário</h2>
      </div>
      <div className="mb-5 flex items-center justify-between text-white">
        <button type="button" onClick={voltarMes} className="rounded-lg px-3 text-2xl leading-none hover:bg-white/10">‹</button>
        <p className="font-semibold capitalize">{mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
        <button type="button" onClick={avancarMes} className="rounded-lg px-3 text-2xl leading-none hover:bg-white/10">›</button>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-sm text-slate-300">
        {dias.map((d) => <div key={d}>{d}</div>)}
        {diasGrade.map((data) => {
          const iso = data.toISOString().slice(0, 10);
          const foraDoMes = data.getMonth() !== mes;
          const ativo = iso === selecionadaISO;
          const temAgenda = datasComAgenda.has(iso);
          return (
            <button
              type="button"
              key={iso}
              onClick={() => onSelecionar(data)}
              className={`relative grid h-9 place-items-center rounded-full transition ${ativo ? 'bg-[#f6b21a] font-bold text-black shadow-[0_0_24px_rgba(246,178,26,0.35)]' : foraDoMes ? 'text-slate-600 hover:bg-white/5' : 'text-slate-200 hover:bg-white/10'}`}
            >
              {data.getDate()}
              {temAgenda && !ativo && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#f6b21a]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}


function slugDaRota(pathname: string) {
  const seg = String(pathname || "").split("?")[0].split("/").filter(Boolean)[0] || "";
  const reservados = new Set(["login", "agendar", "admin", "admin-master"]);
  return seg && !reservados.has(seg) ? seg : "";
}

function prefixarRota(path: string, slug: string) {
  if (!slug) return path;
  if (path === "/") return `/${slug}/`;
  return `/${slug}${path}`;
}

export default function Home() {
  const [location] = useLocation();
  const slug = slugDaRota(location);
  const rota = (path: string) => prefixarRota(path, slug);

  const { agendamentos, clientes, totalFaturado, carregando } = useBarbearia();
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAgendamento[]>([]);
  const [processandoSolicitacao, setProcessandoSolicitacao] = useState<string | null>(null);
  const [mostrarSolicitacoes, setMostrarSolicitacoes] = useState(true);
  const dataSelecionadaISO = dataSelecionada.toISOString().slice(0, 10);
  const dataHojeBR = new Date().toLocaleDateString('pt-BR');

  const carregarSolicitacoes = async () => {
    try {
      const dados = await api('/api/solicitacoes-agendamento');
      setSolicitacoes(dados || []);
    } catch {
      setSolicitacoes([]);
    }
  };

  useEffect(() => {
    carregarSolicitacoes();
  }, []);

  const confirmarSolicitacao = async (id: string) => {
    try {
      setProcessandoSolicitacao(id);
      const resposta = await api(`/api/solicitacoes-agendamento/${id}/confirmar`, { method: 'PUT' });
      setSolicitacoes((lista) => lista.filter((item) => item.id !== id));

      if (resposta?.telefone && resposta?.mensagemWhatsApp) {
        abrirWhatsapp(resposta.telefone, resposta.mensagemWhatsApp);
      }

      alert('Solicitação confirmada e agendamento criado.');
    } catch (e: any) {
      alert('Erro ao confirmar solicitação: ' + (e?.message || String(e)));
    } finally {
      setProcessandoSolicitacao(null);
    }
  };

  const recusarSolicitacao = async (id: string) => {
    try {
      if (!confirm('Recusar esta solicitação?')) return;
      setProcessandoSolicitacao(id);
      const resposta = await api(`/api/solicitacoes-agendamento/${id}/recusar`, { method: 'PUT' });
      setSolicitacoes((lista) => lista.filter((item) => item.id !== id));

      if (resposta?.telefone && resposta?.mensagemWhatsApp) {
        abrirWhatsapp(resposta.telefone, resposta.mensagemWhatsApp);
      }
    } catch (e: any) {
      alert('Erro ao recusar solicitação: ' + (e?.message || String(e)));
    } finally {
      setProcessandoSolicitacao(null);
    }
  };

  const datasComAgenda = useMemo(() => new Set(agendamentos.filter((a) => a.status !== 'Cancelado' && a.status !== 'Solicitado').map((a) => dataParaISO(a.data)).filter(Boolean)), [agendamentos]);
  const agendaDoDia = agendamentos
    .filter((a) => dataParaISO(a.data) === dataSelecionadaISO && a.status !== 'Cancelado' && a.status !== 'Solicitado')
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
    .slice(0, 5);

  const agendamentosHoje = agendamentos.filter((a) => (a.data === dataHojeBR || dataParaISO(a.data) === new Date().toISOString().slice(0, 10)) && a.status !== 'Cancelado' && a.status !== 'Solicitado');
  const recebimentosHoje = agendamentosHoje.filter((a) => a.status !== 'Cancelado' && a.status !== 'Solicitado').reduce((soma, a) => soma + Number(a.valor || 0), 0);
  const servicosRealizados = agendamentos.filter((a) => a.status === 'Realizado').length;
  const aguardandoConfirmacao = agendamentosHoje.filter((a) => a.status === 'Agendado').length;
  const lembretesPendentes = agendamentosHoje.filter((a) => a.status === 'Agendado' || a.status === 'Confirmado').length;

  return (
    <div className="min-h-screen bg-[#070b12] p-5 pb-24 text-white md:p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Bem-vindo! 👋</h1>
          {carregando && <p className="mt-2 text-sm text-[#f6b21a]">Carregando dados do banco...</p>}
        </div>
        <div className="flex items-center gap-4">
          <Link href={rota("/agendamentos")}>
            <button
              type="button"
              className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
              title="Ver pendências da agenda"
            >
              <Bell className="h-6 w-6" />
              {(lembretesPendentes + solicitacoes.length) > 0 && (
                <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-[#f6b21a] px-1 text-xs font-bold text-black">
                  {lembretesPendentes + solicitacoes.length}
                </span>
              )}
            </button>
          </Link>
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3">
            <CalendarDays className="h-6 w-6 text-[#f6b21a]" />
            <div>
              <p className="text-lg font-bold">{formatarDataBR(new Date())}</p>
              <p className="text-sm text-slate-400 capitalize">{new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
            </div>
          </div>
        </div>
      </div>

      {solicitacoes.length > 0 && (
        <div className="mb-6 rounded-2xl border border-[#f6b21a]/30 bg-[#f6b21a]/10 p-4 shadow-2xl shadow-black/20">
          <button
            type="button"
            onClick={() => setMostrarSolicitacoes((valor) => !valor)}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f6b21a] text-black">
                <Bell className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-white">
                  Solicitações de Agendamento
                </h2>
                <p className="text-sm text-slate-300">
                  {solicitacoes.length} pendente(s) aguardando confirmação
                </p>
              </div>
            </div>

            <span className="shrink-0 rounded-full bg-[#f6b21a] px-3 py-1 text-sm font-bold text-black">
              {mostrarSolicitacoes ? "Ocultar" : "Ver"} {solicitacoes.length}
            </span>
          </button>

          {mostrarSolicitacoes && (
            <div className="mt-4 grid gap-3">
              {solicitacoes.slice(0, 3).map((solicitacao) => (
                <div
                  key={solicitacao.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-white">{solicitacao.nomeCliente}</p>
                    <p className="text-sm text-slate-300">{solicitacao.telefone}</p>
                    <p className="mt-1 truncate text-sm text-slate-200">
                      {solicitacao.servicos?.length
                        ? solicitacao.servicos.map((servico) => servico.nome).join(" + ")
                        : solicitacao.servicoNome}
                      {" • "}
                      {solicitacao.profissionalNome}
                      {" • "}
                      {solicitacao.data} às {solicitacao.hora}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => confirmarSolicitacao(solicitacao.id)}
                      disabled={processandoSolicitacao === solicitacao.id}
                      className="h-9 rounded-xl bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                    >
                      Confirmar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => recusarSolicitacao(solicitacao.id)}
                      disabled={processandoSolicitacao === solicitacao.id}
                      className="h-9 rounded-xl border-red-400/50 bg-transparent px-4 text-red-300 hover:bg-red-500/10"
                    >
                      Recusar
                    </Button>
                  </div>
                </div>
              ))}

              {solicitacoes.length > 3 && (
                <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-300">
                  Mais {solicitacoes.length - 3} solicitação(ões) pendente(s). Acesse a agenda para visualizar todas.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <MetricCard icon={CalendarDays} label="Agendamentos hoje" value={agendamentosHoje.length} link="Ver agenda" linkPath="/agendamentos" colorClass="bg-violet-600/80 text-white" />
        <MetricCard icon={Users} label="Clientes" value={clientes.length} link="Ver clientes" linkPath="/clientes" colorClass="bg-emerald-600/60 text-emerald-100" />
        <MetricCard icon={DollarSign} label="Recebimentos hoje" value={formatarMoeda(recebimentosHoje)} link="Ver financeiro" linkPath="/financeiro" colorClass="bg-orange-600/50 text-orange-100" />
        <MetricCard icon={ClipboardList} label="Serviços realizados" value={servicosRealizados} link="Ver serviços" linkPath="/relatorios" colorClass="bg-blue-600/60 text-blue-100" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-5 shadow-2xl shadow-black/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Agenda do Dia</h2>
              <p className="text-sm text-slate-400">{formatarDataBR(dataSelecionada)}</p>
            </div>
            <Link href="/agendamentos">
              <Button variant="outline" className="rounded-xl border-white/10 bg-transparent text-white hover:bg-white/10">
                Ver agenda completa
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {agendaDoDia.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-8 text-center text-slate-400">
                Nenhum agendamento encontrado para esta data.
              </div>
            ) : agendaDoDia.map((agendamento: any, idx) => (
              <div key={agendamento.id ?? idx} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
                <div className={`h-8 w-1 rounded-full ${agendamento.status === 'Confirmado' ? 'bg-emerald-400' : 'bg-violet-500'}`} />
                <div className="w-16 text-lg font-semibold">{agendamento.hora}</div>
                
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="h-10 w-10 border border-[#f6b21a]/30">
                    <AvatarFallback className="bg-[#f6b21a]/15 font-bold text-[#f6b21a]">
                      {(agendamento.clienteNome || "C")
                        .split(" ")
                        .filter(Boolean)
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="truncate font-bold">{agendamento.clienteNome}</p>
                </div>
                <div className="hidden min-w-[220px] md:block">
                  <p className="text-slate-100">{agendamento.servicoNome}</p>
                  <p className="text-sm text-slate-400">{agendamento.profissionalNome}</p>
                </div>
                <StatusBadge status={agendamento.status} />
              </div>
            ))}
          </div>

          <Link href="/agendamentos">
            <button className="mt-7 flex w-full items-center justify-center gap-2 text-slate-300 hover:text-[#f6b21a]">
              Ver todos os agendamentos <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </div>

        <div className="space-y-6">
          <CalendarMini selecionada={dataSelecionada} onSelecionar={setDataSelecionada} datasComAgenda={datasComAgenda} />

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-6 shadow-2xl shadow-black/20">
            <h2 className="mb-5 text-xl font-bold text-white">Pendências reais</h2>
            <div className="divide-y divide-white/10">
              <Link href="/agendamentos">
                <div className="flex cursor-pointer items-center gap-4 py-4 hover:text-[#f6b21a]">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f6b21a] text-black">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{solicitacoes.length} solicitação(ões) aguardando confirmação</p>
                    <p className="mt-1 text-slate-400">Verificar agora <ArrowRight className="ml-1 inline h-4 w-4" /></p>
                  </div>
                </div>
              </Link>

              <Link href="/agendamentos">
                <div className="flex cursor-pointer items-center gap-4 py-4 hover:text-[#f6b21a]">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{lembretesPendentes + solicitacoes.length} lembrete(s) para enviar</p>
                    <p className="mt-1 text-slate-400">Enviar agora <ArrowRight className="ml-1 inline h-4 w-4" /></p>
                  </div>
                </div>
              </Link>

              <Link href="/relatorios">
                <div className="flex cursor-pointer items-center gap-4 py-4 hover:text-[#f6b21a]">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-600 text-white">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Total faturado: {formatarMoeda(totalFaturado())}</p>
                    <p className="mt-1 text-slate-400">Visualizar relatório <ArrowRight className="ml-1 inline h-4 w-4" /></p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
