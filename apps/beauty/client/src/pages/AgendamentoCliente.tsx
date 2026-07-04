import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Scissors,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0));
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error || "Erro ao comunicar com o sistema.");
  }
  return json?.data;
}

type Servico = {
  id: string;
  nome: string;
  valor: number;
  duracao?: string;
};

type Profissional = {
  id: string;
  nome: string;
  apelido?: string;
  nomePublico?: string;
  funcao?: string;
  antecedenciaAgendamento?: number;
  servicosIds?: string[];
};

type HorarioPublico = {
  hora: string;
  disponivel: boolean;
  bloqueadoAntecedencia?: boolean;
  antecedenciaAgendamento?: number;
  motivo?: string;
};

type EmpresaPublica = {
  nome?: string;
  marca?: string;
  telefone?: string;
  logoEmpresa?: string;
  logoMenu?: string;
  antecedenciaAgendamento?: number;
};

const CHAVE_AGENDAMENTO_CLIENTE = "agendamento_online_cliente";

function dataHoraLocal(data: string, hora: string) {
  if (!data || !hora) return null;
  const [ano, mes, dia] = data.split("-").map(Number);
  const [horas, minutos] = hora.split(":").map(Number);
  if (!ano || !mes || !dia || Number.isNaN(horas) || Number.isNaN(minutos))
    return null;
  return new Date(ano, mes - 1, dia, horas, minutos, 0, 0);
}

function respeitaPrazoMinimo(data: string, hora: string, horasAntecedencia: number) {
  if (!horasAntecedencia) return true;
  const inicio = dataHoraLocal(data, hora);
  if (!inicio) return false;
  const limite = new Date(Date.now() + horasAntecedencia * 60 * 60 * 1000);
  return inicio.getTime() >= limite.getTime();
}

function formatarDataHora(data: string, hora: string) {
  const inicio = dataHoraLocal(data, hora);
  if (!inicio) return `${data} às ${hora}`;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(inicio);
}

type AgendamentoSalvo = {
  nome: string;
  telefone: string;
  data: string;
  hora: string;
  profissionalId: string;
  servicosIds: string[];
  criadoEm: string;
  id?: string;
};

function duracaoParaMinutos(duracao?: string) {
  if (!duracao) return 30;
  const texto = String(duracao).toLowerCase();
  const numeros = texto.match(/\d+/g);
  if (!numeros?.length) return 30;
  if (texto.includes("h")) {
    return Math.max(15, Number(numeros[0] || 0) * 60 + Number(numeros[1] || 0));
  }
  return Math.max(15, Number(numeros[0] || 30));
}

export default function AgendamentoCliente() {
  const [empresa, setEmpresa] = useState<EmpresaPublica>({});
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [horarios, setHorarios] = useState<HorarioPublico[]>([]);
  const [servicosSelecionados, setServicosSelecionados] = useState<string[]>(
    [],
  );
  const [profissionalId, setProfissionalId] = useState("");
  const [data, setData] = useState(hojeISO());
  const [hora, setHora] = useState("");
  const [cliente, setCliente] = useState({ nome: "", telefone: "" });
  const [carregando, setCarregando] = useState(true);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [agendamentoSalvo, setAgendamentoSalvo] =
    useState<AgendamentoSalvo | null>(null);
  const [antecedenciaAtual, setAntecedenciaAtual] = useState(12);

  const servicosEscolhidos = useMemo(
    () => servicos.filter((s) => servicosSelecionados.includes(String(s.id))),
    [servicos, servicosSelecionados],
  );

  const profissionalSelecionado = useMemo(
    () => profissionais.find((p) => String(p.id) === String(profissionalId)),
    [profissionais, profissionalId],
  );

  const servicosDisponiveis = useMemo(() => {
    if (!profissionalSelecionado) return [];
    const ids = Array.isArray(profissionalSelecionado.servicosIds)
      ? profissionalSelecionado.servicosIds.map(String)
      : [];
    return servicos.filter((s) => ids.includes(String(s.id)));
  }, [servicos, profissionalSelecionado]);

  const antecedenciaProfissional = Number(profissionalSelecionado?.antecedenciaAgendamento || 0);
  const antecedenciaExibida = antecedenciaAtual || antecedenciaProfissional || Number(empresa.antecedenciaAgendamento || 12);

  const totalValor = servicosEscolhidos.reduce(
    (s, item) => s + Number(item.valor || 0),
    0,
  );
  const totalDuracao = servicosEscolhidos.reduce(
    (s, item) => s + duracaoParaMinutos(item.duracao),
    0,
  );

  useEffect(() => {
    if (!profissionalSelecionado) {
      setServicosSelecionados([]);
      setHora("");
      return;
    }

    const idsPermitidos = new Set(servicosDisponiveis.map((s) => String(s.id)));
    setServicosSelecionados((lista) => lista.filter((id) => idsPermitidos.has(String(id))));
    setHora("");
  }, [profissionalId, profissionalSelecionado, servicosDisponiveis]);

  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE_AGENDAMENTO_CLIENTE);
    if (salvo) {
      try {
        setAgendamentoSalvo(JSON.parse(salvo));
      } catch {
        localStorage.removeItem(CHAVE_AGENDAMENTO_CLIENTE);
      }
    }
  }, []);

  useEffect(() => {
    api("/api/publico/agendamento/dados")
      .then((dados) => {
        setEmpresa(dados?.empresa || {});
        setServicos(dados?.servicos || []);
        setProfissionais(dados?.profissionais || []);
      })
      .catch((e) => setErro(e?.message || "Erro ao carregar dados."))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    setHora("");
    setMensagem("");
    if (!servicosSelecionados.length || !profissionalId || !data) {
      setHorarios([]);
      return;
    }

    setCarregandoHorarios(true);
    api(
      `/api/publico/agendamento/horarios?servicosIds=${encodeURIComponent(servicosSelecionados.join(","))}&profissionalId=${encodeURIComponent(profissionalId)}&data=${encodeURIComponent(data)}`,
    )
      .then((dados) => {
        setHorarios(dados?.horarios || []);
        setAntecedenciaAtual(Number(dados?.antecedenciaAgendamento || antecedenciaProfissional || empresa.antecedenciaAgendamento || 12));
      })
      .catch((e) => setErro(e?.message || "Erro ao carregar horários."))
      .finally(() => setCarregandoHorarios(false));
  }, [servicosSelecionados, profissionalId, data]);

  const alternarServico = (id: string) => {
    setMensagem("");
    setErro("");
    setServicosSelecionados((lista) =>
      lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id],
    );
  };

  const solicitar = async () => {
    try {
      setErro("");
      setMensagem("");

      if (!cliente.nome.trim()) throw new Error("Informe seu nome.");
      if (!cliente.telefone.trim()) throw new Error("Informe seu WhatsApp.");
      if (!servicosSelecionados.length)
        throw new Error("Escolha pelo menos um serviço.");
      if (!profissionalId) throw new Error("Escolha um profissional.");
      if (!data) throw new Error("Escolha a data.");
      if (!hora) throw new Error("Escolha um horário disponível.");

      if (!respeitaPrazoMinimo(data, hora, antecedenciaExibida)) {
        throw new Error(
          `Este horário não pode ser agendado. Escolha um horário com pelo menos ${antecedenciaExibida}h de antecedência.`,
        );
      }

      const telefoneAtual = cliente.telefone.replace(/\D/g, "");
      const telefoneSalvo = agendamentoSalvo?.telefone?.replace(/\D/g, "");
      const existeAgendamentoDoCliente = Boolean(
        agendamentoSalvo && telefoneAtual && telefoneAtual === telefoneSalvo,
      );

      if (existeAgendamentoDoCliente) {
        const mesmoHorario =
          agendamentoSalvo?.data === data &&
          agendamentoSalvo?.hora === hora &&
          String(agendamentoSalvo?.profissionalId) === String(profissionalId);

        if (mesmoHorario) {
          throw new Error(
            `Você já possui uma solicitação para ${formatarDataHora(agendamentoSalvo.data, agendamentoSalvo.hora)}.`,
          );
        }

        const trocar = window.confirm(
          `Você já possui um agendamento para ${formatarDataHora(
            agendamentoSalvo!.data,
            agendamentoSalvo!.hora,
          )}. Deseja trocar para ${formatarDataHora(data, hora)}?`,
        );

        if (!trocar) {
          setMensagem(
            "Agendamento anterior mantido. Nenhuma nova solicitação foi enviada.",
          );
          return;
        }
      }

      setEnviando(true);
      const agendamentoCriado = await api(
        "/api/publico/agendamento/solicitar",
        {
          method: "POST",
          body: JSON.stringify({
            nome: cliente.nome.trim(),
            telefone: cliente.telefone.trim(),
            servicosIds: servicosSelecionados,
            profissionalId,
            data,
            hora,
            trocarHorario: existeAgendamentoDoCliente,
            agendamentoAnteriorId: agendamentoSalvo?.id,
          }),
        },
      );

      const novoAgendamento: AgendamentoSalvo = {
        id: agendamentoCriado?.id,
        nome: cliente.nome.trim(),
        telefone: cliente.telefone.trim(),
        servicosIds: servicosSelecionados,
        profissionalId,
        data,
        hora,
        criadoEm: new Date().toISOString(),
      };
      localStorage.setItem(
        CHAVE_AGENDAMENTO_CLIENTE,
        JSON.stringify(novoAgendamento),
      );
      setAgendamentoSalvo(novoAgendamento);

      setMensagem(
        existeAgendamentoDoCliente
          ? "Solicitação de troca enviada com sucesso. Aguarde a confirmação do profissional."
          : "Solicitação enviada com sucesso. Aguarde a confirmação do profissional.",
      );
      setHora("");

      const dadosHorarios = await api(
        `/api/publico/agendamento/horarios?servicosIds=${encodeURIComponent(servicosSelecionados.join(","))}&profissionalId=${encodeURIComponent(profissionalId)}&data=${encodeURIComponent(data)}`,
      );
      setHorarios(dadosHorarios?.horarios || []);
      setAntecedenciaAtual(Number(dadosHorarios?.antecedenciaAgendamento || antecedenciaExibida));
    } catch (e: any) {
      setErro(e?.message || "Erro ao solicitar agendamento.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 md:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {(empresa.logoMenu || empresa.logoEmpresa) && (
              <img
                src={empresa.logoMenu || empresa.logoEmpresa}
                alt={empresa.nome || "Logo"}
                className="h-16 w-16 rounded-2xl object-contain"
              />
            )}
            <div>
              <p className="text-sm font-bold text-amber-400">
                Agendamento online
              </p>
              <h1 className="text-2xl font-black md:text-4xl">
                {empresa.nome || empresa.marca || "Agende seu horário"}
              </h1>
              <p className="mt-1 text-sm text-slate-300 md:text-base">
                Solicite seu atendimento. A confirmação será feita pelo
                profissional.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Agende com no mínimo {antecedenciaExibida}h de
            antecedência.
          </div>
        </header>

        <main className="grid flex-1 gap-6 lg:grid-cols-[1fr_380px]">
          <section className="rounded-3xl border border-white/10 bg-white p-5 text-slate-950 shadow-2xl md:p-6">
            <div className="mb-5 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-amber-600" />
              <h2 className="text-xl font-black">Escolha seu horário</h2>
            </div>

            {carregando ? (
              <div className="rounded-2xl bg-slate-100 p-6 text-center text-slate-500">
                Carregando...
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Profissional</Label>
                    <Select
                      value={profissionalId}
                      onValueChange={setProfissionalId}
                    >
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue placeholder="Escolha o profissional" />
                      </SelectTrigger>
                      <SelectContent>
                        {profissionais.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.apelido || p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Data</Label>
                    <Input
                      type="date"
                      min={hojeISO()}
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      className="h-12 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <Label>Serviços disponíveis para o profissional</Label>
                  {!profissionalId ? (
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-slate-500">
                      Escolha primeiro o profissional para visualizar os serviços que ele executa.
                    </div>
                  ) : servicosDisponiveis.length === 0 ? (
                    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-amber-700">
                      Este profissional ainda não possui serviços habilitados. Configure os serviços na tela Profissionais.
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      {servicosDisponiveis.map((s) => {
                        const selecionado = servicosSelecionados.includes(String(s.id));
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => alternarServico(String(s.id))}
                            className={`rounded-2xl border p-4 text-left transition ${
                              selecionado
                                ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                                : "border-slate-200 bg-slate-50 hover:border-amber-300"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-black text-slate-950">{s.nome}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Duração: {s.duracao || "30 min"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-amber-700">{dinheiro(s.valor)}</p>
                                <p className="mt-1 text-xs font-bold text-slate-500">
                                  {selecionado ? "Selecionado" : "Selecionar"}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 font-bold">
                    <Clock className="h-4 w-4 text-amber-600" />
                    Horários
                  </div>

                  {carregandoHorarios ? (
                    <div className="rounded-xl bg-white p-5 text-center text-slate-500">
                      Carregando horários...
                    </div>
                  ) : horarios.length ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                      {horarios.map((h) => {
                        const dentroPrazo = !h.bloqueadoAntecedencia && respeitaPrazoMinimo(data, h.hora, Number(h.antecedenciaAgendamento || antecedenciaExibida));
                        const podeAgendar = h.disponivel && dentroPrazo;
                        return (
                          <button
                            key={h.hora}
                            type="button"
                            disabled={!podeAgendar}
                            onClick={() => podeAgendar && setHora(h.hora)}
                            className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                              hora === h.hora
                                ? "border-amber-500 bg-amber-500 text-white"
                                : podeAgendar
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-500"
                                  : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through"
                            }`}
                          >
                            {h.hora}
                            <div className="mt-1 text-[10px] font-semibold">
                              {!h.disponivel
                                ? "Indisponível"
                                : !dentroPrazo
                                  ? h.motivo || `Mín. ${h.antecedenciaAgendamento || antecedenciaExibida}h`
                                  : "Disponível"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white p-5 text-center text-slate-500">
                      Escolha serviço(s), profissional e data para ver os
                      horários.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="mb-5 flex items-center gap-2">
              <User className="h-5 w-5 text-amber-400" />
              <h2 className="text-xl font-black">Seus dados</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-white">Nome</Label>
                <Input
                  value={cliente.nome}
                  onChange={(e) =>
                    setCliente({ ...cliente, nome: e.target.value })
                  }
                  placeholder="Seu nome"
                  className="h-12 rounded-xl border-white/20 bg-slate-800 text-white placeholder:text-slate-400"
                />
              </div>

              <div>
                <Label className="text-white">WhatsApp</Label>
                <Input
                  value={cliente.telefone}
                  onChange={(e) =>
                    setCliente({ ...cliente, telefone: e.target.value })
                  }
                  placeholder="(63) 99999-9999"
                  className="h-12 rounded-xl border-white/20 bg-slate-800 text-white placeholder:text-slate-400"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
                <p className="mb-2 flex items-center gap-2 font-bold text-white">
                  <Scissors className="h-4 w-4 text-amber-400" /> Resumo
                </p>
                <p>
                  Serviço(s):{" "}
                  <b>
                    {servicosEscolhidos.length
                      ? servicosEscolhidos.map((s) => s.nome).join(" + ")
                      : "Nenhum selecionado"}
                  </b>
                </p>
                <p>
                  Profissional:{" "}
                  <b>{profissionalSelecionado?.apelido || profissionalSelecionado?.nome || "Não selecionado"}</b>
                </p>
                <p>
                  Data: <b>{data}</b>
                </p>
                <p>
                  Hora: <b>{hora || "Não selecionado"}</b>
                </p>
                <p>
                  Duração total: <b>{totalDuracao || 0} min</b>
                </p>
                <p>
                  Valor total: <b>{dinheiro(totalValor)}</b>
                </p>
              </div>

              {agendamentoSalvo && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  Você já possui uma solicitação salva para{" "}
                  <b>
                    {formatarDataHora(
                      agendamentoSalvo.data,
                      agendamentoSalvo.hora,
                    )}
                  </b>
                  . Ao solicitar outro horário com o mesmo WhatsApp, o sistema
                  perguntará se deseja trocar.
                </div>
              )}

              {erro && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {erro}
                </div>
              )}
              {mensagem && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  {mensagem}
                </div>
              )}

              <Button
                onClick={solicitar}
                disabled={enviando}
                className="h-12 w-full rounded-xl bg-amber-500 font-black text-black hover:bg-amber-400"
              >
                {enviando ? "Enviando..." : "Solicitar agendamento"}
              </Button>

              <div className="flex items-start gap-2 text-xs text-slate-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  Após solicitar, o profissional confirma o horário. Você
                  receberá a confirmação pelo WhatsApp.
                </span>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
