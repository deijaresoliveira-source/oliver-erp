import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBarbearia } from "@/contexts/BarbeariaContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit2,
  MessageCircle,
  PackagePlus,
  Plus,
  Scissors,
  Trash2,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type FormaPagamento = string;
type StatusAgendamento =
  | "Solicitado"
  | "Agendado"
  | "Confirmado"
  | "Realizado"
  | "Cancelado"
  | "Faltou";

type ItemServico = {
  id: string;
  nome: string;
  valor: number;
  duracaoMinutos: number;
};

type ItemProduto = {
  id: string;
  nome: string;
  valor: number;
  quantidade: number;
};

type HorarioTrabalho = {
  id?: string;
  profissionalId: string;
  diaSemana: string;
  ativo: boolean;
  inicio?: string;
  fim?: string;
  intervaloInicio?: string;
  intervaloFim?: string;
};

const statusColors: Record<string, string> = {
  Solicitado: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Agendado: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Confirmado: "bg-green-500/20 text-green-300 border-green-500/30",
  Realizado: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  Cancelado: "bg-red-500/20 text-red-300 border-red-500/30",
  Faltou: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

function agendamentoPago(agendamento: any) {
  return (
    Boolean(agendamento?.pago) ||
    Boolean(agendamento?.assinaturaPaga) ||
    Number(agendamento?.assinatura_paga || 0) === 1 ||
    String(agendamento?.observacao || "")
      .toUpperCase()
      .includes("ASSINATURA PAGA") ||
    String(agendamento?.observacao || "")
      .toUpperCase()
      .includes("PAGO")
  );
}

function dataParaISO(data: string) {
  if (!data) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const partes = data.split("/");
  if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
  return data;
}

function isoParaBR(data: string) {
  if (!data) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return data;
  const partes = data.split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return data;
}

function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0));
}

function duracaoParaMinutos(duracao: string | number | undefined) {
  if (!duracao) return 30;
  if (typeof duracao === "number") return duracao || 30;
  const texto = String(duracao).toLowerCase();
  const numeros = texto.match(/\d+/g);
  if (!numeros?.length) return 30;
  if (texto.includes("h")) {
    const horas = Number(numeros[0] || 0);
    const minutos = Number(numeros[1] || 0);
    return Math.max(15, horas * 60 + minutos);
  }
  return Math.max(15, Number(numeros[0] || 30));
}

function horaParaMinutos(hora: string) {
  const [h, m] = (hora || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function minutosParaHora(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const diasSemanaBR = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function diaSemanaDaData(data: string) {
  const iso = dataParaISO(data);
  const partes = String(iso || "")
    .split("-")
    .map(Number);
  if (partes.length === 3 && partes.every(Boolean)) {
    return diasSemanaBR[new Date(partes[0], partes[1] - 1, partes[2]).getDay()];
  }
  return diasSemanaBR[new Date(iso).getDay()];
}

function telefoneParaWhatsApp(telefone: string) {
  const numero = String(telefone || "").replace(/\D/g, "");

  if (!numero) return "";

  // Se já vier com DDI 55, mantém. Caso contrário, adiciona 55.
  return numero.startsWith("55") ? numero : `55${numero}`;
}

function abrirWhatsapp(telefone: string, mensagem: string) {
  const numero = telefoneParaWhatsApp(telefone);

  if (!numero) {
    alert("Cliente sem telefone cadastrado.");
    return;
  }

  const texto = encodeURIComponent(mensagem);

  // Tenta abrir diretamente o aplicativo do WhatsApp.
  const appUrl = `whatsapp://send?phone=${numero}&text=${texto}`;

  // Fallback para WhatsApp Web, caso o app não abra no computador/celular.
  const webUrl = `https://wa.me/${numero}?text=${texto}`;

  window.location.href = appUrl;

  setTimeout(() => {
    window.open(webUrl, "_blank");
  }, 900);
}

const MARCADOR_SERVICOS = "[[SERVICOS_AGENDAMENTO_JSON]]";

function extrairServicosSalvos(observacao: string | undefined): ItemServico[] {
  const texto = String(observacao || "");
  const regex =
    /\[\[SERVICOS_AGENDAMENTO_JSON\]\]([\s\S]*?)\[\[\/SERVICOS_AGENDAMENTO_JSON\]\]/;
  const match = texto.match(regex);

  if (!match?.[1]) return [];

  try {
    const lista = JSON.parse(match[1]);
    if (!Array.isArray(lista)) return [];

    return lista
      .filter((item) => item && item.id && item.nome)
      .map((item) => ({
        id: String(item.id),
        nome: String(item.nome),
        valor: Number(item.valor || 0),
        duracaoMinutos: Number(item.duracaoMinutos || 30),
      }));
  } catch {
    return [];
  }
}

function removerServicosSalvosDaObservacao(observacao: string | undefined) {
  return String(observacao || "")
    .replace(
      /\n?\[\[SERVICOS_AGENDAMENTO_JSON\]\][\s\S]*?\[\[\/SERVICOS_AGENDAMENTO_JSON\]\]/g,
      "",
    )
    .trim();
}

export default function Agendamentos() {
  const contexto = useBarbearia() as any;
  const { usuario, pode } = useAuth();
  const agendaSomenteMinha = Boolean(usuario && usuario.perfil !== "Administrador" && pode("agenda.ver_apenas_minha") && usuario.profissionalId);
  const {
    clientes,
    profissionais,
    servicos,
    agendamentos,
    adicionarAgendamento,
    atualizarAgendamento,
    deletarAgendamento,
  } = contexto;
  const formasPagamentoContexto = contexto.formasPagamento || [];
  const [formasPagamentoServidor, setFormasPagamentoServidor] = useState<any[]>([]);
  const formasPagamento = formasPagamentoServidor.length ? formasPagamentoServidor : formasPagamentoContexto;

  const [produtos, setProdutos] = useState<any[]>(contexto.produtos || []);
  const [agendamentosServidor, setAgendamentosServidor] = useState<any[]>([]);
  const [horariosTrabalho, setHorariosTrabalho] = useState<HorarioTrabalho[]>(
    [],
  );
  const [modalAberto, setModalAberto] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [agendamentoPagamento, setAgendamentoPagamento] = useState<any | null>(
    null,
  );

  const [servicoSelecionadoId, setServicoSelecionadoId] = useState("");
  const [servicoExtraId, setServicoExtraId] = useState("");
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState("");
  const [produtoQuantidade, setProdutoQuantidade] = useState(1);

  const hoje = new Date().toISOString().slice(0, 10);
  const [dataGrade, setDataGrade] = useState(hoje);
  const [profissionalGradeId, setProfissionalGradeId] = useState("todos");

  const [formData, setFormData] = useState({
    clienteId: "",
    profissionalId: "",
    data: hoje,
    hora: "",
    formaPagamento: "Pix" as FormaPagamento,
    status: "Agendado" as StatusAgendamento,
    observacao: "",
  });
  const [servicosEscolhidos, setServicosEscolhidos] = useState<ItemServico[]>(
    [],
  );

  const [servicosPagamento, setServicosPagamento] = useState<ItemServico[]>([]);
  const [produtosPagamento, setProdutosPagamento] = useState<ItemProduto[]>([]);
  const [formaPagamentoFinal, setFormaPagamentoFinal] =
    useState<FormaPagamento>("Pix");
  const [descontoTipo, setDescontoTipo] = useState<"valor" | "percentual">("valor");
  const [descontoValor, setDescontoValor] = useState(0);
  const [descontoMotivo, setDescontoMotivo] = useState("");

  useEffect(() => {
    fetch("/api/formas-pagamento")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setFormasPagamentoServidor(json?.data || json || []))
      .catch(() => setFormasPagamentoServidor([]));
  }, []);

  const carregarProdutosServidor = async () => {
    try {
      const r = await fetch("/api/produtos");
      const json = await r.json().catch(() => null);

      if (r.ok) {
        const lista = json?.data || json || [];
        setProdutos(Array.isArray(lista) ? lista : []);
      }
    } catch {
      setProdutos(contexto.produtos || []);
    }
  };

  useEffect(() => {
    carregarProdutosServidor();
  }, [contexto.produtos]);

  useEffect(() => {
    if (modalPagamentoAberto) {
      carregarProdutosServidor();
    }
  }, [modalPagamentoAberto]);

  const carregarAgendaDoServidor = async () => {
    try {
      const r = await fetch("/api/bootstrap");
      const json = await r.json().catch(() => null);
      if (r.ok && json?.data) {
        setAgendamentosServidor(json.data.agendamentos || []);
        if (json.data.horariosTrabalho)
          setHorariosTrabalho(json.data.horariosTrabalho || []);
      }
    } catch {
      // mantém os dados do contexto quando a API não responder
    }
  };

  useEffect(() => {
    carregarAgendaDoServidor();

    const aoFocar = () => carregarAgendaDoServidor();
    window.addEventListener("focus", aoFocar);
    return () => window.removeEventListener("focus", aoFocar);
  }, []);

  useEffect(() => {
    fetch("/api/horarios-trabalho")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setHorariosTrabalho(json?.data || []))
      .catch(() => setHorariosTrabalho([]));
  }, []);

  useEffect(() => {
    if (agendaSomenteMinha && usuario?.profissionalId) {
      setProfissionalGradeId(String(usuario.profissionalId));
    }
  }, [agendaSomenteMinha, usuario?.profissionalId]);

  const totalServicos = servicosEscolhidos.reduce(
    (s, item) => s + Number(item.valor || 0),
    0,
  );
  const duracaoTotal =
    servicosEscolhidos.reduce(
      (s, item) => s + Number(item.duracaoMinutos || 0),
      0,
    ) || 30;
  const totalPagamentoServicos = servicosPagamento.reduce(
    (s, item) => s + Number(item.valor || 0),
    0,
  );
  const totalPagamentoProdutos = produtosPagamento.reduce(
    (s, item) => s + Number(item.valor || 0) * Number(item.quantidade || 1),
    0,
  );
  const subtotalPagamento = totalPagamentoServicos + totalPagamentoProdutos;
  const valorDescontoPagamento = Number(
    Math.min(
      subtotalPagamento,
      Math.max(
        0,
        descontoTipo === "percentual"
          ? (subtotalPagamento * Number(descontoValor || 0)) / 100
          : Number(descontoValor || 0),
      ),
    ).toFixed(2),
  );
  const totalPagamento = Number((subtotalPagamento - valorDescontoPagamento).toFixed(2));
  const formasPagamentoPadrao = [
    { nome: "Pix", taxaPercentual: 0 },
    { nome: "Dinheiro", taxaPercentual: 0 },
    { nome: "Débito", taxaPercentual: 1.99 },
    { nome: "Crédito 1x", taxaPercentual: 3.49 },
    { nome: "Crédito 2x", taxaPercentual: 4.49 },
    { nome: "Crédito 3x", taxaPercentual: 5.49 },
  ];
  const formasPagamentoDisponiveis = formasPagamento.length ? formasPagamento : formasPagamentoPadrao;
  const formaPagamentoSelecionada = formasPagamentoDisponiveis.find(
    (f: any) => String(f.nome) === String(formaPagamentoFinal),
  );
  const taxaPagamentoPercentual = Number(
    formaPagamentoSelecionada?.taxaPercentual ??
      formaPagamentoSelecionada?.taxa ??
      0,
  );
  const valorTaxaPagamento = Number(
    ((totalPagamento * taxaPagamentoPercentual) / 100).toFixed(2),
  );
  const valorLiquidoPagamento = Number(
    (totalPagamento - valorTaxaPagamento).toFixed(2),
  );
  const agendamentosBase = agendamentosServidor.length
    ? agendamentosServidor
    : agendamentos;

  const agendamentosAtuais = agendaSomenteMinha
    ? agendamentosBase.filter((a: any) => String(a.profissionalId) === String(usuario?.profissionalId))
    : agendamentosBase;

  const agendamentosOrdenados = useMemo(() => {
    return [...agendamentosAtuais].sort((a, b) => {
      const dataA = new Date(dataParaISO(a.data) + "T" + (a.hora || "00:00"));
      const dataB = new Date(dataParaISO(b.data) + "T" + (b.hora || "00:00"));
      return dataA.getTime() - dataB.getTime();
    });
  }, [agendamentosAtuais]);

  const agendamentosDoDia = useMemo(() => {
    return agendamentosOrdenados.filter((a: any) => {
      const mesmaData = dataParaISO(a.data) === dataGrade;
      const mesmoProfissional =
        profissionalGradeId === "todos" ||
        String(a.profissionalId) === String(profissionalGradeId);
      return mesmaData && mesmoProfissional && a.status !== "Cancelado";
    });
  }, [agendamentosOrdenados, dataGrade, profissionalGradeId]);

  const horarioDoProfissionalNoDia = (profissionalId: string, data: string) => {
    const diaSemana = diaSemanaDaData(data);
    return horariosTrabalho.find(
      (h) =>
        String(h.profissionalId) === String(profissionalId) &&
        h.diaSemana === diaSemana,
    );
  };

  const profissionalTrabalhaNoDia = (profissionalId: string, data: string) => {
    const configurados = horariosTrabalho.filter(
      (h) => String(h.profissionalId) === String(profissionalId),
    );
    if (!configurados.length) return true;
    const horario = horarioDoProfissionalNoDia(profissionalId, data);
    return Boolean(horario?.ativo);
  };

  const horaDentroDoExpediente = (
    hora: string,
    profissionalId: string,
    data: string,
  ) => {
    const configurados = horariosTrabalho.filter(
      (h) => String(h.profissionalId) === String(profissionalId),
    );
    if (!configurados.length) return true;

    const horario = horarioDoProfissionalNoDia(profissionalId, data);
    if (!horario?.ativo) return false;

    const min = horaParaMinutos(hora);
    const inicio = horario.inicio ? horaParaMinutos(horario.inicio) : 0;
    const fim = horario.fim ? horaParaMinutos(horario.fim) : 24 * 60;
    const intervaloInicio = horario.intervaloInicio
      ? horaParaMinutos(horario.intervaloInicio)
      : 0;
    const intervaloFim = horario.intervaloFim
      ? horaParaMinutos(horario.intervaloFim)
      : 0;

    if (min < inicio || min >= fim) return false;
    if (
      intervaloInicio &&
      intervaloFim &&
      min >= intervaloInicio &&
      min < intervaloFim
    )
      return false;
    return true;
  };

  const horarioSuportaDuracao = (
    hora: string,
    profissionalId: string,
    data: string,
    duracaoMinutos: number,
  ) => {
    const configurados = horariosTrabalho.filter(
      (h) => String(h.profissionalId) === String(profissionalId),
    );
    if (!configurados.length) return true;

    const horario = horarioDoProfissionalNoDia(profissionalId, data);
    if (!horario?.ativo) return false;

    const inicioAgendamento = horaParaMinutos(hora);
    const fimAgendamento =
      inicioAgendamento + Math.max(1, Number(duracaoMinutos || 30));
    const inicioExpediente = horario.inicio
      ? horaParaMinutos(horario.inicio)
      : 0;
    const fimExpediente = horario.fim ? horaParaMinutos(horario.fim) : 24 * 60;
    const intervaloInicio = horario.intervaloInicio
      ? horaParaMinutos(horario.intervaloInicio)
      : 0;
    const intervaloFim = horario.intervaloFim
      ? horaParaMinutos(horario.intervaloFim)
      : 0;

    if (inicioAgendamento < inicioExpediente || fimAgendamento > fimExpediente)
      return false;
    if (
      intervaloInicio &&
      intervaloFim &&
      inicioAgendamento < intervaloFim &&
      fimAgendamento > intervaloInicio
    )
      return false;
    return true;
  };

  const horariosGradeDoProfissional = (profissionalId: string) => {
    const configurados = horariosTrabalho.filter(
      (h) => String(h.profissionalId) === String(profissionalId),
    );
    const horario = horarioDoProfissionalNoDia(profissionalId, dataGrade);

    if (configurados.length && !horario?.ativo) return [];

    const inicio = horario?.inicio ? horaParaMinutos(horario.inicio) : 8 * 60;
    const fim = horario?.fim ? horaParaMinutos(horario.fim) : 18 * 60;
    const intervaloInicio = horario?.intervaloInicio
      ? horaParaMinutos(horario.intervaloInicio)
      : 0;
    const intervaloFim = horario?.intervaloFim
      ? horaParaMinutos(horario.intervaloFim)
      : 0;

    const profissional = profissionais.find(
      (p: any) => String(p.id) === String(profissionalId),
    );
    const intervaloAgenda = [15, 20, 25, 30, 35].includes(
      Number(profissional?.intervaloAgenda || profissional?.intervalo_agenda || 30),
    )
      ? Number(profissional?.intervaloAgenda || profissional?.intervalo_agenda || 30)
      : 30;

    const lista: string[] = [];
    for (let min = inicio; min < fim; min += intervaloAgenda) {
      if (
        intervaloInicio &&
        intervaloFim &&
        min >= intervaloInicio &&
        min < intervaloFim
      )
        continue;
      lista.push(minutosParaHora(min));
    }
    return lista;
  };

  const servicoParaItem = (servico: any): ItemServico => ({
    id: String(servico.id),
    nome: servico.nome,
    valor: Number(servico.valor || 0),
    duracaoMinutos: duracaoParaMinutos(servico.duracao),
  });

  const adicionarServicoNoAgendamento = () => {
    if (!servicoSelecionadoId) return;
    const servico = servicos.find(
      (s: any) => String(s.id) === String(servicoSelecionadoId),
    );
    if (!servico) return;
    if (servicosEscolhidos.some((s) => s.id === String(servico.id))) {
      alert("Este serviço já foi adicionado.");
      return;
    }
    setServicosEscolhidos((lista) => [...lista, servicoParaItem(servico)]);
    setServicoSelecionadoId("");
  };

  const adicionarServicoNoPagamento = () => {
    if (!servicoExtraId) return;
    const servico = servicos.find(
      (s: any) => String(s.id) === String(servicoExtraId),
    );
    if (!servico) return;
    setServicosPagamento((lista) => [...lista, servicoParaItem(servico)]);
    setServicoExtraId("");
  };

  const adicionarProdutoNoPagamento = () => {
    if (!produtoSelecionadoId) return;
    const produto = produtos.find(
      (p: any) => String(p.id) === String(produtoSelecionadoId),
    );
    if (!produto) return;
    const valor = Number(
      produto.valorVenda ??
        produto.valor_venda ??
        produto.precoVenda ??
        produto.preco_venda ??
        produto.valor ??
        produto.preco ??
        0,
    );
    setProdutosPagamento((lista) => [
      ...lista,
      {
        id: String(produto.id),
        nome: produto.nome,
        valor,
        quantidade: Math.max(1, Number(produtoQuantidade || 1)),
      },
    ]);
    setProdutoSelecionadoId("");
    setProdutoQuantidade(1);
  };

  const carregarServicosDoAgendamento = (agendamento: any) => {
    const servicosSalvos = extrairServicosSalvos(agendamento.observacao);
    if (servicosSalvos.length > 0) return servicosSalvos;

    if (
      Array.isArray(agendamento.servicosSelecionados) &&
      agendamento.servicosSelecionados.length > 0
    ) {
      return agendamento.servicosSelecionados.map((item: any) => ({
        id: String(item.id),
        nome: String(item.nome),
        valor: Number(item.valor || 0),
        duracaoMinutos: Number(item.duracaoMinutos || 30),
      }));
    }

    const servicoPrincipal = servicos.find(
      (s: any) => String(s.id) === String(agendamento.servicoId),
    );
    if (servicoPrincipal) return [servicoParaItem(servicoPrincipal)];

    if (agendamento.servicoNome) {
      const nomes = String(agendamento.servicoNome)
        .split(" + ")
        .map((nome) => nome.trim())
        .filter(Boolean);
      if (nomes.length > 1) {
        const valorUnitario = Number(agendamento.valor || 0) / nomes.length;
        return nomes.map((nome, index) => ({
          id: `${agendamento.servicoId || "manual"}-${index}`,
          nome,
          valor: valorUnitario,
          duracaoMinutos: 30,
        }));
      }

      return [
        {
          id: String(agendamento.servicoId || "manual"),
          nome: agendamento.servicoNome,
          valor: Number(agendamento.valor || 0),
          duracaoMinutos: 30,
        },
      ];
    }

    return [];
  };

  const handleAbrirModal = (
    agendamentoId?: string,
    data?: string,
    hora?: string,
    profissionalId?: string,
  ) => {
    if (agendamentoId) {
      const agendamento = agendamentosAtuais.find(
        (a: any) => a.id === agendamentoId,
      );
      if (agendamento) {
        setFormData({
          clienteId: agendamento.clienteId,
          profissionalId: agendamento.profissionalId,
          data: dataParaISO(agendamento.data),
          hora: agendamento.hora,
          formaPagamento: agendamento.formaPagamento || "Pix",
          status: agendamento.status || "Agendado",
          observacao: removerServicosSalvosDaObservacao(agendamento.observacao),
        });
        setServicosEscolhidos(carregarServicosDoAgendamento(agendamento));
        setEditando(agendamentoId);
      }
    } else {
      setFormData({
        clienteId: "",
        profissionalId:
          profissionalId && profissionalId !== "todos" ? profissionalId : "",
        data: data || dataGrade || hoje,
        hora: hora || "",
        formaPagamento: "Pix",
        status: "Agendado",
        observacao: "",
      });
      setServicosEscolhidos([]);
      setEditando(null);
    }
    setServicoSelecionadoId("");
    setModalAberto(true);
  };

  const conflitoPorDuracao = (
    data: string,
    hora: string,
    profissionalId: string,
    duracaoMinutos: number,
    excludeId?: string,
  ) => {
    const inicioNovo = horaParaMinutos(hora);
    const fimNovo = inicioNovo + duracaoMinutos;

    return agendamentosAtuais.some((a: any) => {
      if (a.id === excludeId || a.status === "Cancelado") return false;
      if (dataParaISO(a.data) !== dataParaISO(data)) return false;
      if (String(a.profissionalId) !== String(profissionalId)) return false;

      const inicioExistente = horaParaMinutos(a.hora);
      const servicosExistentes = carregarServicosDoAgendamento(a);
      const duracaoExistente =
        servicosExistentes.reduce(
          (total: number, item: ItemServico) =>
            total + Number(item.duracaoMinutos || 0),
          0,
        ) ||
        duracaoParaMinutos(
          servicos.find((s: any) => String(s.id) === String(a.servicoId))
            ?.duracao || 30,
        );
      const fimExistente = inicioExistente + duracaoExistente;

      return inicioNovo < fimExistente && fimNovo > inicioExistente;
    });
  };

  const handleSalvar = async () => {
    if (
      !formData.clienteId ||
      !formData.profissionalId ||
      !formData.data ||
      !formData.hora ||
      servicosEscolhidos.length === 0
    ) {
      alert(
        "Informe cliente, profissional, data, hora e pelo menos um serviço.",
      );
      return;
    }

    if (!profissionalTrabalhaNoDia(formData.profissionalId, formData.data)) {
      alert(`O profissional não atende em ${diaSemanaDaData(formData.data)}.`);
      return;
    }

    if (
      !horaDentroDoExpediente(
        formData.hora,
        formData.profissionalId,
        formData.data,
      )
    ) {
      alert(
        "Este horário está fora do expediente ou no intervalo do profissional.",
      );
      return;
    }

    if (
      !horarioSuportaDuracao(
        formData.hora,
        formData.profissionalId,
        formData.data,
        duracaoTotal,
      )
    ) {
      alert(
        `A duração do serviço não cabe neste horário. O atendimento terminaria às ${minutosParaHora(horaParaMinutos(formData.hora) + duracaoTotal)}, fora do expediente ou dentro do intervalo.`,
      );
      return;
    }

    if (
      conflitoPorDuracao(
        formData.data,
        formData.hora,
        formData.profissionalId,
        duracaoTotal,
        editando || undefined,
      )
    ) {
      const fimTentativa = minutosParaHora(
        horaParaMinutos(formData.hora) + duracaoTotal,
      );
      alert(
        `Este horário está ocupado ou conflita com a duração dos serviços escolhidos. A tentativa ocuparia até ${fimTentativa}. Escolha outro horário.`,
      );
      return;
    }

    const cliente = clientes.find(
      (c: any) => String(c.id) === String(formData.clienteId),
    );
    const profissional = profissionais.find(
      (p: any) => String(p.id) === String(formData.profissionalId),
    );
    const servicoPrincipal = servicosEscolhidos[0];

    if (!cliente || !profissional || !servicoPrincipal) {
      alert("Dados inválidos.");
      return;
    }

    const resumoServicos = servicosEscolhidos
      .map((s) => `${s.nome} (${dinheiro(s.valor)})`)
      .join(", ");
    const servicosJson = JSON.stringify(servicosEscolhidos);
    const observacaoLimpa = removerServicosSalvosDaObservacao(
      formData.observacao,
    );

    const observacaoFinal = [
      observacaoLimpa,
      servicosEscolhidos.length > 1
        ? `Serviços adicionados: ${resumoServicos}`
        : "",
      `Duração total estimada: ${duracaoTotal} minutos`,
      `${MARCADOR_SERVICOS}${servicosJson}[[/SERVICOS_AGENDAMENTO_JSON]]`,
    ]
      .filter(Boolean)
      .join("\n");

    const dados = {
      clienteId: formData.clienteId,
      clienteNome: cliente.nome,
      telefonCliente: cliente.telefone,
      servicoId: servicoPrincipal.id,
      servicoNome: servicosEscolhidos.map((s) => s.nome).join(" + "),
      profissionalId: formData.profissionalId,
      profissionalNome: profissional.nome,
      data: formData.data,
      hora: formData.hora,
      valor: totalServicos,
      formaPagamento: formData.formaPagamento,
      status: formData.status,
      observacao: observacaoFinal,
      servicosSelecionados: servicosEscolhidos,
      duracaoMinutos: duracaoTotal,
    };

    if (editando) await atualizarAgendamento(editando, dados);
    else await adicionarAgendamento(dados);

    await carregarAgendaDoServidor();
    setModalAberto(false);
  };

  const enviarWhatsAppConfirmacao = (agendamento: any) => {
    if (agendamento.status === "Realizado") {
      alert("Atendimento já realizado. O envio de WhatsApp está bloqueado.");
      return;
    }

    const mensagem = [
      `Olá, ${agendamento.clienteNome}! Tudo bem?`,
      "",
      "Estamos entrando em contato para confirmar o seu agendamento:",
      "",
      `📅 Data: ${isoParaBR(dataParaISO(agendamento.data))}`,
      `⏰ Horário: ${agendamento.hora}`,
      `💈 Serviço: ${agendamento.servicoNome}`,
      `👤 Profissional: ${agendamento.profissionalNome}`,
      "",
      "Por favor, responda:",
      "✅ SIM para confirmar seu horário",
      "❌ NÃO caso não possa comparecer",
      "",
      "Aguardamos sua confirmação. Obrigado!",
    ].join("\n");

    abrirWhatsapp(agendamento.telefonCliente, mensagem);
  };

  const enviarWhatsAppAgendamentoConfirmado = async (agendamento: any) => {
    if (agendamento.status === "Realizado") {
      alert("Atendimento já realizado. O envio de WhatsApp está bloqueado.");
      return;
    }

    const mensagem = [
      `Olá, ${agendamento.clienteNome}!`,
      "",
      "✅ Seu agendamento está CONFIRMADO.",
      "",
      `📅 Data: ${isoParaBR(dataParaISO(agendamento.data))}`,
      `⏰ Horário: ${agendamento.hora}`,
      `💈 Serviço: ${agendamento.servicoNome}`,
      `👤 Profissional: ${agendamento.profissionalNome}`,
      "",
      "Pedimos que chegue com alguns minutos de antecedência.",
      "Caso precise remarcar ou cancelar, avise com antecedência.",
      "",
      "Obrigado pela preferência!",
    ].join("\n");

    try {
      await atualizarAgendamento(agendamento.id, {
        ...agendamento,
        status: "Confirmado",
      });
      await carregarAgendaDoServidor();
    } catch {
      // Mesmo se o status não salvar, a mensagem pode ser enviada normalmente.
    }

    abrirWhatsapp(agendamento.telefonCliente, mensagem);
  };

  const enviarWhatsAppPagamento = (agendamento: any, valor: number) => {
    const mensagem = [
      `Olá, ${agendamento.clienteNome}!`,
      "",
      `✅ Confirmamos o recebimento de ${dinheiro(valor)} referente ao atendimento realizado.`,
      "",
      `💈 Serviço: ${agendamento.servicoNome}`,
      `📅 Data: ${isoParaBR(dataParaISO(agendamento.data))}`,
      "",
      "Obrigado pela preferência!",
    ].join("\n");

    abrirWhatsapp(agendamento.telefonCliente, mensagem);
  };

  const enviarParaFila = async (agendamento: any) => {
    if (!agendamento?.clienteId) {
      alert("Agendamento sem cliente vinculado.");
      return;
    }

    try {
      const r = await fetch("/api/fila", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: agendamento.clienteId,
          servicoId: agendamento.servicoId || null,
          profissionalId: agendamento.profissionalId || null,
          observacao: [
            "Entrada enviada pela Agenda.",
            `Agendamento: ${isoParaBR(dataParaISO(agendamento.data))} às ${agendamento.hora}.`,
            agendamento.assinaturaId ? `Assinatura #${agendamento.assinaturaId}` : "",
            agendamentoPago(agendamento) ? "ASSINATURA/ATENDIMENTO PAGO" : "PAGAMENTO PENDENTE",
          ].filter(Boolean).join("\n"),
        }),
      });

      const json = await r.json().catch(() => null);
      if (!r.ok || json?.ok === false) {
        throw new Error(json?.error || "Erro ao enviar para a fila.");
      }

      await carregarAgendaDoServidor();
      alert("Cliente enviado para a fila de atendimento.");
    } catch (e: any) {
      alert("Erro ao enviar para fila: " + (e?.message || String(e)));
    }
  };

  const abrirPagamento = (agendamento: any) => {
    setAgendamentoPagamento(agendamento);
    setServicosPagamento(carregarServicosDoAgendamento(agendamento));
    setProdutosPagamento([]);
    const formaAtual = String(agendamento.formaPagamento || "");
    const existeForma = formasPagamentoDisponiveis.some(
      (f: any) => String(f.nome) === formaAtual,
    );
    setFormaPagamentoFinal(
      formaAtual && formaAtual !== "Pendente" && existeForma
        ? formaAtual
        : String(formasPagamentoDisponiveis[0]?.nome || "Pix"),
    );
    setServicoExtraId("");
    setProdutoSelecionadoId("");
    setProdutoQuantidade(1);
    setDescontoTipo("valor");
    setDescontoValor(0);
    setDescontoMotivo("");
    setModalPagamentoAberto(true);
  };

  const confirmarPagamento = async () => {
    if (!agendamentoPagamento) return;
    if (totalPagamento <= 0) {
      alert("Adicione pelo menos um serviço ou produto para receber.");
      return;
    }

    try {
      const resultadoFinalizacao = await fetch(`/api/agendamentos/${agendamentoPagamento.id}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formaPagamento: formaPagamentoFinal,
          taxaPercentual: taxaPagamentoPercentual,
          valorTaxa: valorTaxaPagamento,
          valorLiquido: valorLiquidoPagamento,
          descontoTipo,
          descontoValor: valorDescontoPagamento,
          descontoMotivo,
          servicos: servicosPagamento.map((s) => ({
            id: s.id,
            nome: s.nome,
            valor: Number(s.valor || 0),
            duracaoMinutos: Number(s.duracaoMinutos || 30),
            quantidade: 1,
          })),
          produtos: produtosPagamento.map((p) => ({
            id: p.id,
            nome: p.nome,
            valor: Number(p.valor || 0),
            quantidade: Number(p.quantidade || 1),
          })),
        }),
      }).then(async (r) => {
        const json = await r.json().catch(() => null);
        if (!r.ok || json?.ok === false) {
          throw new Error(json?.error || "Erro ao finalizar atendimento");
        }
        return json?.data;
      });

      // A rota /finalizar já atualiza o agendamento no banco.
      // Não atualizamos novamente aqui para não sobrescrever o valor proporcional
      // da assinatura nem apagar a observação/comissão gerada pelo backend.
      await carregarAgendaDoServidor();
      alert(
        resultadoFinalizacao?.avisoComissao ||
          "Atendimento finalizado. Estoque, saldo e comissão foram processados.",
      );
      setModalPagamentoAberto(false);
    } catch (e: any) {
      alert("Erro ao confirmar pagamento: " + (e?.message || String(e)));
    }
  };

  const estornarPagamento = async () => {
    if (!agendamentoPagamento) return;

    const motivo = window.prompt("Informe o motivo do estorno:");
    if (motivo === null) return;
    if (!motivo.trim()) {
      alert("Informe o motivo do estorno.");
      return;
    }

    try {
      const r = await fetch(`/api/agendamentos/${agendamentoPagamento.id}/estornar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok || json?.ok === false) {
        throw new Error(json?.error || "Erro ao estornar pagamento");
      }

      await carregarAgendaDoServidor();
      setModalPagamentoAberto(false);
      alert("Pagamento estornado com sucesso.");
    } catch (e: any) {
      alert("Erro ao estornar pagamento: " + (e?.message || String(e)));
    }
  };

  const agendamentoQueOcupaHorario = (hora: string, profissional: any) => {
    const slotMin = horaParaMinutos(hora);

    return agendamentosDoDia.find((a: any) => {
      if (String(a.profissionalId) !== String(profissional.id)) return false;
      const inicio = horaParaMinutos(a.hora);
      const servicosExistentes = carregarServicosDoAgendamento(a);
      const duracaoExistente =
        servicosExistentes.reduce(
          (total: number, item: ItemServico) =>
            total + Number(item.duracaoMinutos || 0),
          0,
        ) ||
        duracaoParaMinutos(
          servicos.find((s: any) => String(s.id) === String(a.servicoId))
            ?.duracao || 30,
        );
      const fim = inicio + duracaoExistente;
      return slotMin >= inicio && slotMin < fim;
    });
  };

  const renderSlot = (hora: string, profissional: any) => {
    const agendamento = agendamentoQueOcupaHorario(hora, profissional);
    const ocupado = Boolean(agendamento);
    const inicioAgendamento = agendamento
      ? horaParaMinutos(agendamento.hora)
      : 0;
    const servicosExistentes = agendamento
      ? carregarServicosDoAgendamento(agendamento)
      : [];
    const duracaoExistente = agendamento
      ? servicosExistentes.reduce(
          (total: number, item: ItemServico) =>
            total + Number(item.duracaoMinutos || 0),
          0,
        ) ||
        duracaoParaMinutos(
          servicos.find(
            (s: any) => String(s.id) === String(agendamento.servicoId),
          )?.duracao || 30,
        )
      : 0;
    const fimAgendamento = agendamento
      ? minutosParaHora(inicioAgendamento + duracaoExistente)
      : "";
    const ehInicioAgendamento = ocupado && agendamento?.hora === hora;
    const trabalhaNoDia = profissionalTrabalhaNoDia(
      String(profissional.id),
      dataGrade,
    );
    const disponivelNoHorario = horaDentroDoExpediente(
      hora,
      String(profissional.id),
      dataGrade,
    );
    const indisponivel = !trabalhaNoDia || !disponivelNoHorario;

    return (
      <button
        key={`${profissional.id}-${hora}`}
        type="button"
        disabled={indisponivel && !ocupado}
        onClick={() => {
          if (ocupado) return handleAbrirModal(agendamento.id);
          if (indisponivel) return;
          handleAbrirModal(undefined, dataGrade, hora, profissional.id);
        }}
        className={`rounded-2xl border p-3 text-left transition ${
          ocupado
            ? ehInicioAgendamento
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "cursor-not-allowed border-amber-500/30 bg-amber-500/10 text-amber-200"
            : indisponivel
              ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground opacity-60"
              : "border-border bg-card hover:border-primary hover:bg-primary/5"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold">{hora}</span>
          {ocupado ? (
            agendamentoPago(agendamento) ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
                Pago
              </span>
            ) : (
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                {ehInicioAgendamento ? "Ocupado" : "Bloqueado"}
              </span>
            )
          ) : indisponivel ? (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">
              Indisponível
            </span>
          ) : (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
              Livre
            </span>
          )}
        </div>
        {ocupado ? (
          <div className="mt-2 space-y-1 text-sm">
            <p className="font-semibold">{agendamento.clienteNome}</p>
            <p className="text-muted-foreground">{agendamento.servicoNome}</p>
            <p className="text-xs text-muted-foreground">
              Ocupado até {fimAgendamento}
            </p>
          </div>
        ) : indisponivel ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {!trabalhaNoDia
              ? `Não atende em ${diaSemanaDaData(dataGrade)}`
              : "Fora do expediente/intervalo"}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Clique para agendar
          </p>
        )}
      </button>
    );
  };

  const profissionaisVisiveis = agendaSomenteMinha
    ? profissionais.filter((p: any) => String(p.id) === String(usuario?.profissionalId))
    : profissionais;

  const profissionaisGrade =
    profissionalGradeId === "todos"
      ? profissionaisVisiveis
      : profissionaisVisiveis.filter(
          (p: any) => String(p.id) === String(profissionalGradeId),
        );

  return (
    <div className="min-h-screen bg-background pb-24 pt-16 md:pt-0">
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-8 md:py-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                Agenda
              </h1>
              <p className="text-sm text-muted-foreground md:text-base">
                Calendário com horários livres e ocupados por profissional.
              </p>
            </div>
            <Button
              onClick={() => handleAbrirModal()}
              className="btn-premium gap-2"
            >
              <Plus className="h-4 w-4" /> Novo Agendamento
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={dataGrade}
                onChange={(e) => setDataGrade(e.target.value)}
              />
            </div>
            <div>
              <Label>Profissional</Label>
              <Select
                value={profissionalGradeId}
                onValueChange={setProfissionalGradeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os profissionais" />
                </SelectTrigger>
                <SelectContent>
                  {!agendaSomenteMinha && <SelectItem value="todos">Todos os profissionais</SelectItem>}
                  {profissionaisVisiveis.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.apelido || p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        {profissionaisGrade.length === 0 ? (
          <div className="card-premium py-12 text-center text-muted-foreground">
            Cadastre um profissional para usar a agenda.
          </div>
        ) : (
          <div className="space-y-6">
            {profissionaisGrade.map((profissional: any) => (
              <div
                key={profissional.id}
                className="rounded-3xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{profissional.nome}</h2>
                    <p className="text-sm text-muted-foreground">
                      {isoParaBR(dataGrade)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                  {horariosGradeDoProfissional(String(profissional.id)).map(
                    (hora) => renderSlot(hora, profissional),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-4">
          <h2 className="text-xl font-bold">Agendamentos do dia</h2>
          {agendamentosDoDia.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
              Nenhum agendamento nesta data.
            </div>
          ) : (
            agendamentosDoDia.map((agendamento: any) => (
              <div key={agendamento.id} className="card-premium">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">
                        {agendamento.clienteNome}
                      </h3>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColors[agendamento.status] || statusColors.Agendado}`}
                      >
                        {agendamento.status}
                      </span>
                      {agendamentoPago(agendamento) ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">
                          Pago
                        </span>
                      ) : (
                        <span className="rounded-full border border-orange-500/30 bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-300">
                          Pendente
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {agendamento.servicoNome}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        {agendamento.hora}
                      </span>
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        {agendamento.profissionalNome}
                      </span>
                      <span className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        {dinheiro(agendamento.valor)}
                      </span>
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        {isoParaBR(dataParaISO(agendamento.data))}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAbrirModal(agendamento.id)}
                      className="gap-1"
                    >
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => enviarWhatsAppConfirmacao(agendamento)}
                      className="gap-1 text-primary"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Solicitar confirmação
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        enviarWhatsAppAgendamentoConfirmado(agendamento)
                      }
                      className="gap-1 text-emerald-500"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Enviar confirmação
                    </Button>
                    {agendamento.status !== "Realizado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => enviarParaFila(agendamento)}
                        className="gap-1 text-blue-400"
                      >
                        <UserCheck className="h-4 w-4" />
                        Cliente chegou
                      </Button>
                    )}
                    {agendamento.status !== "Realizado" && (
                      <Button
                        size="sm"
                        onClick={() => abrirPagamento(agendamento)}
                        className="btn-premium gap-1"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {agendamentoPago(agendamento) ? "Finalizar" : "Receber"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive"
                      onClick={async () => {
                        if (confirm("Deseja excluir este agendamento?")) {
                          await deletarAgendamento(agendamento.id);
                          await carregarAgendaDoServidor();
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden border-border bg-card p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <DialogTitle>
              {editando ? "Editar Agendamento" : "Novo Agendamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 pb-28">
            <div>
              <Label>Cliente *</Label>
              <Select
                value={formData.clienteId}
                onValueChange={(value) =>
                  setFormData({ ...formData, clienteId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Profissional *</Label>
              <Select
                value={formData.profissionalId}
                onValueChange={(value) =>
                  setFormData({ ...formData, profissionalId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um profissional" />
                </SelectTrigger>
                <SelectContent>
                  {profissionais.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.apelido || p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={dataParaISO(formData.data)}
                  onChange={(e) =>
                    setFormData({ ...formData, data: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Hora *</Label>
                <Input
                  type="time"
                  value={formData.hora}
                  onChange={(e) =>
                    setFormData({ ...formData, hora: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <Label>Adicionar serviço *</Label>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <Select
                  value={servicoSelecionadoId}
                  onValueChange={setServicoSelecionadoId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {servicos.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.nome} - {dinheiro(s.valor)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={adicionarServicoNoAgendamento}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {servicosEscolhidos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum serviço adicionado.
                  </p>
                ) : (
                  servicosEscolhidos.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-secondary p-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold">{item.nome}</p>
                        <p className="text-muted-foreground">
                          {item.duracaoMinutos} min • {dinheiro(item.valor)}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setServicosEscolhidos((lista) =>
                            lista.filter((s) => s.id !== item.id),
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 rounded-xl bg-primary/10 p-3 text-sm text-primary">
                Total: <b>{dinheiro(totalServicos)}</b> • Duração:{" "}
                <b>{duracaoTotal} minutos</b>
              </div>
            </div>

            {formData.profissionalId &&
              formData.data &&
              formData.hora &&
              servicosEscolhidos.length > 0 &&
              conflitoPorDuracao(
                formData.data,
                formData.hora,
                formData.profissionalId,
                duracaoTotal,
                editando || undefined,
              ) && (
                <div className="flex gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4" /> Este horário
                  conflita com outro atendimento considerando a duração dos
                  serviços.
                </div>
              )}

            {formData.profissionalId &&
              formData.data &&
              formData.hora &&
              servicosEscolhidos.length > 0 &&
              !horarioSuportaDuracao(
                formData.hora,
                formData.profissionalId,
                formData.data,
                duracaoTotal,
              ) && (
                <div className="flex gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                  <AlertCircle className="mt-0.5 h-4 w-4" /> Este serviço dura{" "}
                  {duracaoTotal} minutos e terminaria às{" "}
                  {minutosParaHora(
                    horaParaMinutos(formData.hora) + duracaoTotal,
                  )}
                  . Ajuste o horário para caber no expediente.
                </div>
              )}

            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as StatusAgendamento,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Solicitado">Solicitado</SelectItem>
                  <SelectItem value="Agendado">Agendado</SelectItem>
                  <SelectItem value="Confirmado">Confirmado</SelectItem>
                  <SelectItem value="Realizado">Realizado</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                  <SelectItem value="Faltou">Faltou</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observação</Label>
              <Textarea
                value={formData.observacao}
                onChange={(e) =>
                  setFormData({ ...formData, observacao: e.target.value })
                }
                rows={3}
                placeholder="Notas sobre o agendamento..."
              />
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex shrink-0 gap-2 border-t border-border bg-card p-4">
            <Button
              variant="outline"
              onClick={() => setModalAberto(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleSalvar} className="btn-premium flex-1">
              {editando ? "Atualizar" : "Salvar Agendamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalPagamentoAberto}
        onOpenChange={setModalPagamentoAberto}
      >
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden border-border bg-card p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <DialogTitle>{agendamentoPagamento && agendamentoPago(agendamentoPagamento) ? "Finalizar Atendimento" : "Receber / Finalizar Atendimento"}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 pb-28">
            {agendamentoPagamento && (
              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <p className="font-bold">{agendamentoPagamento.clienteNome}</p>
                <p className="text-sm text-muted-foreground">
                  {isoParaBR(dataParaISO(agendamentoPagamento.data))} às{" "}
                  {agendamentoPagamento.hora}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border p-4">
              <Label>Adicionar outro serviço</Label>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <Select
                  value={servicoExtraId}
                  onValueChange={setServicoExtraId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {servicos.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.nome} - {dinheiro(s.valor)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={adicionarServicoNoPagamento}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {servicosPagamento.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="rounded-xl bg-secondary p-3 text-sm"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-semibold">{item.nome}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setServicosPagamento((lista) =>
                            lista.filter((_, i) => i !== idx),
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Tempo (min)</Label>
                        <Input
                          type="number"
                          min={5}
                          value={item.duracaoMinutos}
                          onChange={(e) =>
                            setServicosPagamento((lista) =>
                              lista.map((s, i) =>
                                i === idx
                                  ? { ...s, duracaoMinutos: Math.max(5, Number(e.target.value || 0)) }
                                  : s,
                              ),
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Valor</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.valor}
                          onChange={(e) =>
                            setServicosPagamento((lista) =>
                              lista.map((s, i) =>
                                i === idx
                                  ? { ...s, valor: Math.max(0, Number(e.target.value || 0)) }
                                  : s,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <Label>Adicionar produto consumido</Label>
              <div className="mt-2 grid grid-cols-[1fr_80px_auto] gap-2">
                <Select
                  value={produtoSelecionadoId}
                  onValueChange={setProdutoSelecionadoId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.length === 0 ? (
                      <SelectItem value="sem-produto" disabled>
                        Nenhum produto cadastrado
                      </SelectItem>
                    ) : (
                      produtos.map((p: any) => {
                        const valor = Number(
                          p.valorVenda ??
                            p.valor_venda ??
                            p.precoVenda ??
                            p.preco_venda ??
                            p.valor ??
                            p.preco ??
                            0,
                        );
                        return (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.nome} - {dinheiro(valor)}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={produtoQuantidade}
                  onChange={(e) =>
                    setProdutoQuantidade(Number(e.target.value || 1))
                  }
                />
                <Button onClick={adicionarProdutoNoPagamento}>
                  <PackagePlus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {produtosPagamento.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-xl bg-secondary p-3 text-sm"
                  >
                    <span>
                      {item.quantidade}x {item.nome}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {dinheiro(item.valor * item.quantidade)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setProdutosPagamento((lista) =>
                            lista.filter((_, i) => i !== idx),
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <Label>Desconto</Label>
              <div className="mt-2 grid grid-cols-[120px_1fr] gap-2">
                <Select value={descontoTipo} onValueChange={(v) => setDescontoTipo(v as "valor" | "percentual")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="valor">R$</SelectItem>
                    <SelectItem value="percentual">%</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={descontoValor}
                  onChange={(e) => setDescontoValor(Number(e.target.value || 0))}
                  placeholder="Valor do desconto"
                />
              </div>
              <Input
                className="mt-2"
                value={descontoMotivo}
                onChange={(e) => setDescontoMotivo(e.target.value)}
                placeholder="Motivo do desconto"
              />
            </div>

            <div>
              <Label>Forma de pagamento</Label>
              <Select
                value={formaPagamentoFinal}
                onValueChange={(v) =>
                  setFormaPagamentoFinal(v as FormaPagamento)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formasPagamentoDisponiveis.map((f: any) => (
                    <SelectItem key={f.nome} value={String(f.nome)}>
                      {f.nome}
                      {Number(f.taxaPercentual ?? f.taxa ?? 0) > 0
                        ? ` - ${Number(f.taxaPercentual ?? f.taxa ?? 0).toFixed(2)}%`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-primary">
              <p className="text-sm">{agendamentoPagamento && agendamentoPago(agendamentoPagamento) ? "Valor do atendimento" : "Total a receber"}</p>
              <p className="text-3xl font-black">{dinheiro(totalPagamento)}</p>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><b>{dinheiro(subtotalPagamento)}</b></div>
              <div className="flex justify-between"><span>Desconto</span><b>{dinheiro(valorDescontoPagamento)}</b></div>
              <div className="flex justify-between"><span>Valor bruto</span><b>{dinheiro(totalPagamento)}</b></div>
              <div className="flex justify-between"><span>Taxa da forma de pagamento ({taxaPagamentoPercentual.toFixed(2)}%)</span><b>{dinheiro(valorTaxaPagamento)}</b></div>
              <div className="mt-2 flex justify-between border-t border-amber-500/20 pt-2 text-base"><span>Valor líquido no caixa</span><b>{dinheiro(valorLiquidoPagamento)}</b></div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 grid shrink-0 grid-cols-1 gap-2 border-t border-border bg-card p-4 sm:grid-cols-4">
            <Button
              variant="outline"
              onClick={() => setModalPagamentoAberto(false)}
              className="w-full"
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="w-full gap-1 text-primary"
              onClick={() =>
                agendamentoPagamento &&
                enviarWhatsAppPagamento(agendamentoPagamento, totalPagamento)
              }
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
            {agendamentoPagamento && agendamentoPago(agendamentoPagamento) && (
              <Button
                variant="outline"
                className="w-full text-destructive"
                onClick={estornarPagamento}
              >
                Estornar
              </Button>
            )}
            <Button onClick={confirmarPagamento} className="btn-premium w-full">
              {agendamentoPagamento && agendamentoPago(agendamentoPagamento) ? "Finalizar Atendimento" : "Confirmar Pagamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
