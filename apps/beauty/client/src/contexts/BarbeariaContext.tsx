import React, { createContext, useContext, useEffect, useState } from "react";

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  observacao?: string;
  dataCadastro: string;
}
export interface Profissional {
  id: string;
  nome: string;
  apelido?: string;
  nomePublico?: string;
  usuarioId?: string;
  usuarioNome?: string;
  funcao: string;
  comissao: number;
  intervaloAgenda?: number;
  antecedenciaAgendamento?: number;
  servicosIds?: string[];
  ativo?: boolean;
  metaMensal?: number;
  especialidades?: string;
}
export interface Servico {
  id: string;
  nome: string;
  valor: number;
  duracao: string;
  categoria?: string;
  comissao?: number;
}
export interface Agendamento {
  id: string;
  clienteId: string;
  clienteNome: string;
  telefonCliente: string;
  servicoId: string;
  servicoNome: string;
  profissionalId: string;
  profissionalNome: string;
  data: string;
  hora: string;
  valor: number;
  formaPagamento: "Pix" | "Dinheiro" | "Cartão" | string;
  status:
    | "Agendado"
    | "Confirmado"
    | "Realizado"
    | "Cancelado"
    | "Faltou"
    | string;
  observacao?: string;
}
export interface FilaAtendimento {
  id: string;
  clienteId: string;
  clienteNome: string;
  telefone?: string;
  servicoId?: string;
  servicoNome?: string;
  profissionalId?: string;
  profissionalNome?: string;
  chegada: string;
  status:
    | "Aguardando"
    | "Chamado"
    | "Em atendimento"
    | "Finalizado"
    | "Cancelado";
  observacao?: string;
}
export interface HorarioTrabalho {
  id?: string;
  profissionalId: string;
  diaSemana:
    | "Segunda"
    | "Terça"
    | "Quarta"
    | "Quinta"
    | "Sexta"
    | "Sábado"
    | "Domingo";
  ativo: boolean;
  inicio: string;
  fim: string;
  intervaloInicio?: string;
  intervaloFim?: string;
}
export interface Produto {
  id: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  codigoBarras?: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  precoCusto: number;
  precoVenda: number;
  ativo?: boolean;
}
export interface FormaPagamento {
  id: string;
  nome: string;
  tipo: string;
  maquinaNome?: string;
  maquinaCodigo?: string;
  chavePix?: string;
  observacao?: string;
  taxaPercentual?: number;
  taxa?: number;
  ativo?: boolean;
}
export interface ComissaoPendente {
  id: string;
  agendamentoId?: string;
  profissionalId: string;
  profissionalNome: string;
  clienteNome?: string;
  descricao: string;
  valorBase: number;
  percentual: number;
  valorComissao: number;
  status: "Pendente" | "Pago";
  data: string;
  dataPagamento?: string;
}
export interface ProdutoFechamento {
  produtoId: string;
  quantidade: number;
}
export interface FinalizarAtendimentoPayload {
  agendamentoId: string;
  formaPagamento: string;
  statusPagamento?: "Pago" | "Pendente";
  produtos: ProdutoFechamento[];
  observacao?: string;
}

interface BarbeariaContextType {
  clientes: Cliente[];
  profissionais: Profissional[];
  servicos: Servico[];
  agendamentos: Agendamento[];
  filaAtendimento: FilaAtendimento[];
  horariosTrabalho: HorarioTrabalho[];
  produtos: Produto[];
  formasPagamento: FormaPagamento[];
  comissoesPendentes: ComissaoPendente[];
  carregando: boolean;
  adicionarCliente: (
    cliente: Omit<Cliente, "id" | "dataCadastro">,
  ) => Promise<void>;
  atualizarCliente: (id: string, cliente: Partial<Cliente>) => Promise<void>;
  deletarCliente: (id: string) => Promise<void>;
  adicionarProfissional: (
    profissional: Omit<Profissional, "id">,
  ) => Promise<void>;
  atualizarProfissional: (
    id: string,
    profissional: Partial<Profissional>,
  ) => Promise<void>;
  deletarProfissional: (id: string) => Promise<void>;
  adicionarServico: (servico: Omit<Servico, "id">) => Promise<void>;
  atualizarServico: (id: string, servico: Partial<Servico>) => Promise<void>;
  deletarServico: (id: string) => Promise<void>;
  adicionarAgendamento: (agendamento: Omit<Agendamento, "id">) => Promise<void>;
  atualizarAgendamento: (
    id: string,
    agendamento: Partial<Agendamento>,
  ) => Promise<void>;
  deletarAgendamento: (id: string) => Promise<void>;
  adicionarFila: (
    item: Omit<FilaAtendimento, "id" | "chegada" | "status">,
  ) => Promise<void>;
  removerFila: (id: string) => Promise<void>;
  chamarProximo: (id: string) => Promise<void>;
  iniciarAtendimentoFila: (id: string) => Promise<void>;
  finalizarFila: (id: string) => Promise<void>;
  salvarHorarioTrabalho: (horario: HorarioTrabalho) => Promise<void>;
  adicionarProduto: (produto: Omit<Produto, "id">) => Promise<void>;
  atualizarProduto: (id: string, produto: Partial<Produto>) => Promise<void>;
  deletarProduto: (id: string) => Promise<void>;
  movimentarEstoque: (
    produtoId: string,
    tipo: "Entrada" | "Saída",
    quantidade: number,
    origem?: string,
  ) => Promise<void>;
  finalizarAtendimento: (payload: FinalizarAtendimentoPayload) => Promise<void>;
  pagarComissao: (id: string, forma?: string) => Promise<void>;
  recarregar: () => Promise<void>;
  totalFaturado: () => number;
  agendamentosProximos: () => Agendamento[];
  agendamentosHoje: () => Agendamento[];
}

const BarbeariaContext = createContext<BarbeariaContextType | undefined>(
  undefined,
);

function slugDaRotaAtual() {
  const seg = String(window.location.pathname || "").split("/").filter(Boolean)[0] || "";
  const reservados = new Set(["login", "agendar", "admin", "admin-master", "api", "assets", "uploads"]);
  return seg && !reservados.has(seg) ? seg : "";
}

function empresaSlugAtual() {
  const usuario = (() => {
    try {
      return JSON.parse(localStorage.getItem("@sistema_saas_usuario") || "null");
    } catch {
      return null;
    }
  })();

  return (
    slugDaRotaAtual() ||
    usuario?.empresaSlug ||
    localStorage.getItem("@sistema_saas_empresa_slug") ||
    "letsbarbearia"
  );
}

function empresaIdAtual() {
  try {
    const usuario = JSON.parse(localStorage.getItem("@sistema_saas_usuario") || "null");
    return usuario?.empresaId || "";
  } catch {
    return "";
  }
}

async function api(path: string, options: RequestInit = {}) {
  const slug = empresaSlugAtual();
  const empresaId = empresaIdAtual();
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-empresa-slug": slug,
      ...(empresaId ? { "x-empresa-id": String(empresaId) } : {}),
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false)
    throw new Error(json?.error || "Erro na API");
  return json?.data;
}

export function BarbeariaProvider({ children }: { children: React.ReactNode }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [filaAtendimento, setFilaAtendimento] = useState<FilaAtendimento[]>([]);
  const [horariosTrabalho, setHorariosTrabalho] = useState<HorarioTrabalho[]>(
    [],
  );
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [comissoesPendentes, setComissoesPendentes] = useState<
    ComissaoPendente[]
  >([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    try {
      const dados = await api("/api/bootstrap");
      setClientes(dados.clientes || []);
      setProfissionais(dados.profissionais || []);
      setServicos(dados.servicos || []);
      setAgendamentos(dados.agendamentos || []);
      setFilaAtendimento(dados.filaAtendimento || []);
      setHorariosTrabalho(dados.horariosTrabalho || []);
      setProdutos(dados.produtos || []);
      setFormasPagamento(dados.formasPagamento || []);
      setComissoesPendentes(dados.comissoesPendentes || []);
    } catch (e) {
      console.error("Erro ao carregar banco:", e);
      setClientes([]);
      setProfissionais([]);
      setServicos([]);
      setAgendamentos([]);
      setFilaAtendimento([]);
      setHorariosTrabalho([]);
      setProdutos([]);
      setFormasPagamento([]);
      setComissoesPendentes([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const adicionarCliente = async (
    cliente: Omit<Cliente, "id" | "dataCadastro">,
  ) => {
    const novo = await api("/api/clientes", {
      method: "POST",
      body: JSON.stringify(cliente),
    });
    setClientes((v) => [novo, ...v]);
  };
  const atualizarCliente = async (id: string, cliente: Partial<Cliente>) => {
    const atual = await api(`/api/clientes/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...clientes.find((c) => c.id === id),
        ...cliente,
      }),
    });
    setClientes((v) => v.map((c) => (c.id === id ? atual : c)));
  };
  const deletarCliente = async (id: string) => {
    await api(`/api/clientes/${id}`, { method: "DELETE" });
    setClientes((v) => v.filter((c) => c.id !== id));
  };

  const adicionarProfissional = async (
    profissional: Omit<Profissional, "id">,
  ) => {
    const novo = await api("/api/profissionais", {
      method: "POST",
      body: JSON.stringify(profissional),
    });
    setProfissionais((v) => [...v, novo]);
  };
  const atualizarProfissional = async (
    id: string,
    profissional: Partial<Profissional>,
  ) => {
    const atual = await api(`/api/profissionais/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...profissionais.find((p) => p.id === id),
        ...profissional,
      }),
    });
    setProfissionais((v) => v.map((p) => (p.id === id ? atual : p)));
  };
  const deletarProfissional = async (id: string) => {
    await api(`/api/profissionais/${id}`, { method: "DELETE" });
    setProfissionais((v) => v.filter((p) => p.id !== id));
  };

  const adicionarServico = async (servico: Omit<Servico, "id">) => {
    const novo = await api("/api/servicos", {
      method: "POST",
      body: JSON.stringify(servico),
    });
    setServicos((v) => [...v, novo]);
  };
  const atualizarServico = async (id: string, servico: Partial<Servico>) => {
    const atual = await api(`/api/servicos/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...servicos.find((s) => s.id === id),
        ...servico,
      }),
    });
    setServicos((v) => v.map((s) => (s.id === id ? atual : s)));
  };
  const deletarServico = async (id: string) => {
    await api(`/api/servicos/${id}`, { method: "DELETE" });
    setServicos((v) => v.filter((s) => s.id !== id));
  };

  const adicionarAgendamento = async (agendamento: Omit<Agendamento, "id">) => {
    const novo = await api("/api/agendamentos", {
      method: "POST",
      body: JSON.stringify(agendamento),
    });
    setAgendamentos((v) => [novo, ...v]);
  };
  const atualizarAgendamento = async (
    id: string,
    agendamento: Partial<Agendamento>,
  ) => {
    const atual = await api(`/api/agendamentos/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...agendamentos.find((a) => a.id === id),
        ...agendamento,
      }),
    });
    setAgendamentos((v) => v.map((a) => (a.id === id ? atual : a)));
  };
  const deletarAgendamento = async (id: string) => {
    await api(`/api/agendamentos/${id}`, { method: "DELETE" });
    setAgendamentos((v) => v.filter((a) => a.id !== id));
  };

  const adicionarFila = async (
    item: Omit<FilaAtendimento, "id" | "chegada" | "status">,
  ) => {
    const novo = await api("/api/fila", {
      method: "POST",
      body: JSON.stringify(item),
    });
    setFilaAtendimento((v) => [novo, ...v]);
  };
  const removerFila = async (id: string) => {
    await api(`/api/fila/${id}`, { method: "DELETE" });
    setFilaAtendimento((v) => v.filter((f) => f.id !== id));
  };
  const mudarStatusFila = async (
    id: string,
    status: FilaAtendimento["status"],
  ) => {
    await api(`/api/fila/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    setFilaAtendimento((v) =>
      v.map((f) => (f.id === id ? { ...f, status } : f)),
    );
  };
  const chamarProximo = (id: string) => mudarStatusFila(id, "Chamado");
  const iniciarAtendimentoFila = (id: string) =>
    mudarStatusFila(id, "Em atendimento");
  const finalizarFila = (id: string) => mudarStatusFila(id, "Finalizado");

  const salvarHorarioTrabalho = async (horario: HorarioTrabalho) => {
    const salvo = await api("/api/horarios-trabalho", {
      method: "POST",
      body: JSON.stringify(horario),
    });
    setHorariosTrabalho((v) => {
      const existe = v.some(
        (h) =>
          h.profissionalId === salvo.profissionalId &&
          h.diaSemana === salvo.diaSemana,
      );
      if (existe)
        return v.map((h) =>
          h.profissionalId === salvo.profissionalId &&
          h.diaSemana === salvo.diaSemana
            ? salvo
            : h,
        );
      return [...v, salvo];
    });
  };

  const adicionarProduto = async (produto: Omit<Produto, "id">) => {
    const novo = await api("/api/produtos", {
      method: "POST",
      body: JSON.stringify(produto),
    });
    setProdutos((v) => [novo, ...v]);
  };
  const atualizarProduto = async (id: string, produto: Partial<Produto>) => {
    const atual = await api(`/api/produtos/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...produtos.find((p) => p.id === id),
        ...produto,
      }),
    });
    setProdutos((v) => v.map((p) => (p.id === id ? atual : p)));
  };
  const deletarProduto = async (id: string) => {
    await api(`/api/produtos/${id}`, { method: "DELETE" });
    setProdutos((v) => v.filter((p) => p.id !== id));
  };
  const movimentarEstoque = async (
    produtoId: string,
    tipo: "Entrada" | "Saída",
    quantidade: number,
    origem = "Manual",
  ) => {
    await api(`/api/produtos/${produtoId}/movimentar`, {
      method: "POST",
      body: JSON.stringify({ tipo, quantidade, origem }),
    });
    await carregar();
  };

  const finalizarAtendimento = async (payload: FinalizarAtendimentoPayload) => {
    await api("/api/finalizar-atendimento", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await carregar();
  };

  const pagarComissao = async (id: string, forma = "Dinheiro") => {
    await api(`/api/comissoes/${id}/pagar`, {
      method: "POST",
      body: JSON.stringify({ forma }),
    });
    await carregar();
  };

  const dataParaISO = (data: string) => {
    if (!data) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
    const partes = data.split("/");
    if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    return data;
  };

  const totalFaturado = () =>
    agendamentos
      .filter((a) => a.status !== "Cancelado")
      .reduce((sum, a) => sum + Number(a.valor || 0), 0);
  const agendamentosProximos = () =>
    agendamentos
      .filter((a) => a.status !== "Cancelado" && a.status !== "Realizado")
      .sort(
        (a, b) =>
          new Date(dataParaISO(a.data) + "T" + (a.hora || "00:00")).getTime() -
          new Date(dataParaISO(b.data) + "T" + (b.hora || "00:00")).getTime(),
      );
  const agendamentosHoje = () => {
    const hoje = new Date().toLocaleDateString("pt-BR");
    const hojeISO = new Date().toISOString().slice(0, 10);
    return agendamentos.filter(
      (a) =>
        (a.data === hoje || dataParaISO(a.data) === hojeISO) &&
        a.status !== "Cancelado",
    );
  };

  return (
    <BarbeariaContext.Provider
      value={{
        clientes,
        profissionais,
        servicos,
        agendamentos,
        filaAtendimento,
        horariosTrabalho,
        produtos,
        formasPagamento,
        comissoesPendentes,
        carregando,
        adicionarCliente,
        atualizarCliente,
        deletarCliente,
        adicionarProfissional,
        atualizarProfissional,
        deletarProfissional,
        adicionarServico,
        atualizarServico,
        deletarServico,
        adicionarAgendamento,
        atualizarAgendamento,
        deletarAgendamento,
        adicionarFila,
        removerFila,
        chamarProximo,
        iniciarAtendimentoFila,
        finalizarFila,
        salvarHorarioTrabalho,
        adicionarProduto,
        atualizarProduto,
        deletarProduto,
        movimentarEstoque,
        finalizarAtendimento,
        pagarComissao,
        recarregar: carregar,
        totalFaturado,
        agendamentosProximos,
        agendamentosHoje,
      }}
    >
      {children}
    </BarbeariaContext.Provider>
  );
}

export function useBarbearia() {
  const context = useContext(BarbeariaContext);
  if (!context)
    throw new Error("useBarbearia deve ser usado dentro de BarbeariaProvider");
  return context;
}
