import { useBarbearia } from "@/contexts/BarbeariaContext";
import {
  Plus,
  X,
  Trash2,
  Pencil,
  CheckCircle2,
  Package,
  Users,
  PauseCircle,
  Calculator,
  CreditCard,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";

type ItemPacote = { servicoId: string; quantidade: number };
type Pacote = {
  id: string;
  nome: string;
  descricao: string;
  itens: ItemPacote[];
  valorOriginal: number;
  valorFinal: number;
  ativo: boolean;
};
type Assinatura = {
  id: string;
  pacoteId: string;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  inicio: string;
  vencimento: string;
  status: "Ativa" | "Pausada" | "Cancelada" | "Pendente";
  pago: boolean;
  profissionalId?: string;
  profissionalNome?: string;
  servicoId?: string;
  servicoNome?: string;
  diaSemana?: string;
  hora?: string;
  gerarAgenda?: boolean;
  agendamentosGerados?: number;
  saldos?: {
    servicoId: string;
    servicoNome: string;
    contratado: number;
    utilizado: number;
    saldo: number;
    valorUnitarioProporcional: number;
  }[];
};
type FormaPagamento = "Pix" | "Dinheiro" | "Cartão" | "Débito" | "Crédito";

type FormAssinatura = {
  pacoteId: string;
  clienteId: string;
  profissionalId: string;
  diaSemana: string;
  hora: string;
  gerarAgenda: boolean;
  inicio: string;
  vencimento: string;
  status: Assinatura["status"];
  pago: boolean;
  formaPagamento: FormaPagamento;
};

const diasSemana = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];
const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v || 0,
  );

const dataBR = (data: string | Date) => {
  if (!data) return "";

  if (typeof data === "string") {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return data;
    if (/^\d{4}-\d{2}-\d{2}/.test(data)) {
      const [ano, mes, dia] = data.slice(0, 10).split("-");
      return `${dia}/${mes}/${ano}`;
    }
  }

  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return String(data);
  return d.toLocaleDateString("pt-BR");
};
async function api(path: string, options: RequestInit = {}) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.ok === false) throw new Error(j?.error || "Erro na API");
  return j?.data;
}

const hojeISO = () => new Date().toISOString().slice(0, 10);
const formAssinaturaPadrao = (): FormAssinatura => ({
  pacoteId: "",
  clienteId: "",
  profissionalId: "",
  diaSemana: "Sexta",
  hora: "14:00",
  gerarAgenda: true,
  inicio: hojeISO(),
  vencimento: hojeISO(),
  status: "Ativa",
  pago: false,
  formaPagamento: "Pix",
});

export default function Planos() {
  const { servicos, clientes, profissionais } = useBarbearia() as any;
  const [aba, setAba] = useState<"pacotes" | "assinaturas">("pacotes");
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [modalPacote, setModalPacote] = useState(false);
  const [modalAssinatura, setModalAssinatura] = useState(false);
  const [editPacote, setEditPacote] = useState<string | null>(null);
  const [editAssinatura, setEditAssinatura] = useState<string | null>(null);
  const [formPacote, setFormPacote] = useState({
    nome: "",
    descricao: "",
    itens: [] as ItemPacote[],
    valorFinal: "",
  });
  const [formAssinatura, setFormAssinatura] = useState<FormAssinatura>(
    formAssinaturaPadrao(),
  );

  const carregar = async () => {
    const [pacotesData, assinaturasData] = await Promise.all([
      api("/api/pacotes"),
      api("/api/assinaturas"),
    ]);
    setPacotes(pacotesData || []);
    setAssinaturas(assinaturasData || []);
  };

  useEffect(() => {
    carregar().catch((e) =>
      alert("Erro ao carregar pacotes/assinaturas: " + e.message),
    );
  }, []);

  const totalOriginal = useMemo(
    () =>
      formPacote.itens.reduce((s, item) => {
        const servico = servicos.find(
          (x: any) => String(x.id) === String(item.servicoId),
        );
        return s + (servico?.valor || 0) * (Number(item.quantidade) || 0);
      }, 0),
    [formPacote.itens, servicos],
  );
  const valorFinal = Number(formPacote.valorFinal || totalOriginal) || 0;
  const desconto = Math.max(0, totalOriginal - valorFinal);
  const assinaturasAtivas = assinaturas.filter((a) => a.status === "Ativa");
  const receitaPrevista = assinaturasAtivas.reduce(
    (s, a) => s + (pacotes.find((p) => p.id === a.pacoteId)?.valorFinal || 0),
    0,
  );
  const pacoteSelecionado = useMemo(
    () => pacotes.find((p) => String(p.id) === String(formAssinatura.pacoteId)),
    [formAssinatura.pacoteId, pacotes],
  );
  const nomesServicosPacoteSelecionado = useMemo(() => {
    if (!pacoteSelecionado?.itens?.length) return [];
    return pacoteSelecionado.itens.map((item) => {
      const servico = servicos.find(
        (x: any) => String(x.id) === String(item.servicoId),
      );
      return servico?.nome || "Serviço";
    });
  }, [pacoteSelecionado, servicos]);

  const registrarPagamentoAssinatura = async (
    assinatura: Assinatura,
    formaPagamento: FormaPagamento,
  ) => {
    const pacote = pacotes.find(
      (p) => String(p.id) === String(assinatura.pacoteId),
    );
    const valor = Number(pacote?.valorFinal || 0);
    if (!valor) return;
    await api("/api/fluxo-caixa", {
      method: "POST",
      body: JSON.stringify({
        tipo: "Entrada",
        descricao: `Pagamento assinatura - ${assinatura.clienteNome} - ${pacote?.nome || "Pacote"}`,
        valor,
        data: hojeISO(),
        origem: "Assinatura",
        forma: formaPagamento,
        status: "Pago",
      }),
    });
  };

  const abrirPacote = (id?: string) => {
    const p = id ? pacotes.find((x) => String(x.id) === String(id)) : undefined;
    if (p) {
      setEditPacote(p.id);
      setFormPacote({
        nome: p.nome,
        descricao: p.descricao,
        itens: p.itens || [],
        valorFinal: String(p.valorFinal),
      });
    } else {
      setEditPacote(null);
      setFormPacote({ nome: "", descricao: "", itens: [], valorFinal: "" });
    }
    setModalPacote(true);
  };

  const abrirAssinatura = (assinatura?: Assinatura) => {
    if (assinatura) {
      if (assinatura.pago) {
        alert("Assinatura paga não pode ser editada.");
        return;
      }
      setEditAssinatura(assinatura.id);
      setFormAssinatura({
        pacoteId: assinatura.pacoteId || "",
        clienteId: assinatura.clienteId || "",
        profissionalId: assinatura.profissionalId || "",
        diaSemana: assinatura.diaSemana || "Sexta",
        hora: assinatura.hora || "14:00",
        gerarAgenda: Boolean(assinatura.gerarAgenda),
        inicio: assinatura.inicio || hojeISO(),
        vencimento: assinatura.vencimento || hojeISO(),
        status: assinatura.status || "Ativa",
        pago: false,
        formaPagamento: "Pix",
      });
    } else {
      setEditAssinatura(null);
      setFormAssinatura(formAssinaturaPadrao());
    }
    setModalAssinatura(true);
  };

  const addItem = () =>
    setFormPacote((f) => ({
      ...f,
      itens: [...f.itens, { servicoId: servicos[0]?.id || "", quantidade: 1 }],
    }));

  const salvarPacote = async () => {
    try {
      if (!formPacote.nome.trim()) return alert("Informe o nome do pacote.");
      if (!formPacote.itens.length)
        return alert("Adicione pelo menos um serviço.");
      const pacote = await api("/api/pacotes", {
        method: "POST",
        body: JSON.stringify({
          id: editPacote || undefined,
          nome: formPacote.nome,
          descricao: formPacote.descricao,
          itens: formPacote.itens,
          valorOriginal: totalOriginal,
          valorFinal,
          ativo: true,
        }),
      });
      setPacotes((lista) =>
        editPacote
          ? lista.map((p) => (p.id === editPacote ? pacote : p))
          : [pacote, ...lista],
      );
      setModalPacote(false);
    } catch (e: any) {
      alert("Erro ao salvar pacote no banco: " + e.message);
    }
  };

  const validarAssinatura = () => {
    const cliente = clientes.find(
      (c: any) => String(c.id) === String(formAssinatura.clienteId),
    );
    if (!formAssinatura.pacoteId || !cliente)
      return "Selecione o pacote e o cliente.";
    if (formAssinatura.gerarAgenda) {
      if (!formAssinatura.profissionalId)
        return "Selecione o profissional para gerar a agenda.";
      if (!formAssinatura.diaSemana) return "Selecione o dia da semana.";
      if (!formAssinatura.hora) return "Informe o horário fixo.";
      if (!nomesServicosPacoteSelecionado.length)
        return "O pacote selecionado não possui serviço para gerar a agenda.";
    }
    return "";
  };

  const salvarAssinatura = async () => {
    try {
      const erro = validarAssinatura();
      if (erro) return alert(erro);
      const path = editAssinatura
        ? `/api/assinaturas/${editAssinatura}`
        : "/api/assinaturas";
      const method = editAssinatura ? "PUT" : "POST";
      const salva = await api(path, {
        method,
        body: JSON.stringify(formAssinatura),
      });
      setAssinaturas((lista) =>
        editAssinatura
          ? lista.map((a) => (a.id === editAssinatura ? salva : a))
          : [salva, ...lista],
      );
      if (formAssinatura.pago)
        await registrarPagamentoAssinatura(
          salva,
          formAssinatura.formaPagamento,
        );
      setModalAssinatura(false);
      setEditAssinatura(null);
      const msgAgenda = formAssinatura.gerarAgenda
        ? formAssinatura.pago
          ? ` Agenda gerada: ${salva.agendamentosGerados || 0} horário(s).`
          : " Agenda será gerada quando receber o pagamento."
        : "";
      alert(
        `${formAssinatura.pago ? "Assinatura paga salva e pagamento lançado no fluxo de caixa." : "Assinatura salva em aberto."}${msgAgenda}`,
      );
    } catch (e: any) {
      alert("Erro ao salvar assinatura no banco: " + e.message);
    }
  };

  const excluirPacote = async (id: string) => {
    try {
      if (!confirm("Excluir pacote?")) return;
      await api(`/api/pacotes/${id}`, { method: "DELETE" });
      setPacotes((l) => l.filter((p) => p.id !== id));
    } catch (e: any) {
      alert("Erro ao excluir pacote no banco: " + e.message);
    }
  };

  const atualizarAssinatura = async (
    a: Assinatura,
    status: Assinatura["status"],
  ) => {
    try {
      const salvo = await api(`/api/assinaturas/${a.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...a, status }),
      });
      setAssinaturas((l) => l.map((x) => (x.id === a.id ? salvo : x)));
    } catch (e: any) {
      alert("Erro ao atualizar assinatura no banco: " + e.message);
    }
  };

  const excluirAssinatura = async (id: string) => {
    try {
      if (!confirm("Excluir assinatura?")) return;
      await api(`/api/assinaturas/${id}`, { method: "DELETE" });
      setAssinaturas((l) => l.filter((a) => a.id !== id));
    } catch (e: any) {
      alert("Erro ao excluir assinatura no banco: " + e.message);
    }
  };

  const receberAssinatura = async (a: Assinatura) => {
    try {
      const forma = (prompt(
        "Forma de pagamento: Pix, Dinheiro, Cartão, Débito ou Crédito",
        "Pix",
      ) || "Pix") as FormaPagamento;
      const salvo = await api(`/api/assinaturas/${a.id}/receber`, {
        method: "POST",
        body: JSON.stringify({ formaPagamento: forma }),
      });
      await registrarPagamentoAssinatura(salvo, forma);
      setAssinaturas((l) => l.map((x) => (x.id === a.id ? salvo : x)));
      await carregar().catch(() => undefined);
      alert(
        `Pagamento lançado no fluxo de caixa. Agenda gerada: ${salvo.agendamentosGerados || 0} horário(s).`,
      );
    } catch (e: any) {
      alert("Erro ao receber assinatura: " + e.message);
    }
  };

  const renovarAssinatura = async (a: Assinatura) => {
    try {
      const pagarAgora = confirm(
  "Deseja renovar e já marcar como pago?\n\n" +
  "OK = renovar pago e gerar agenda\n\n" +
  "Cancelar = renovar em aberto"
  );
      const forma = pagarAgora
        ? ((prompt(
            "Forma de pagamento: Pix, Dinheiro, Cartão, Débito ou Crédito",
            "Pix",
          ) || "Pix") as FormaPagamento)
        : "Pix";

      const nova = await api(`/api/assinaturas/${a.id}/renovar`, {
        method: "POST",
        body: JSON.stringify({ pago: pagarAgora, formaPagamento: forma }),
      });

      if (pagarAgora) await registrarPagamentoAssinatura(nova, forma);
      setAssinaturas((l) => [nova, ...l]);
      await carregar().catch(() => undefined);
      alert(
        `Assinatura renovada para o próximo mês.${pagarAgora ? ` Agenda gerada: ${nova.agendamentosGerados || 0} horário(s).` : " Ficou em aberto para receber depois."}`,
      );
    } catch (e: any) {
      alert("Erro ao renovar assinatura: " + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 pt-16 md:pt-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-black">
              Pacotes e Assinaturas
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Pacotes, assinaturas, agenda recorrente e pagamento com lançamento
              no fluxo de caixa.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => abrirAssinatura()}>
              <Users className="w-4 h-4 mr-2" />
              Nova Assinatura
            </Button>
            <Button onClick={() => abrirPacote()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Pacote
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border bg-card p-5">
            <Package className="text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Pacotes</p>
            <b className="text-3xl">{pacotes.length}</b>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <CheckCircle2 className="text-emerald-500 mb-2" />
            <p className="text-sm text-muted-foreground">Assinaturas ativas</p>
            <b className="text-3xl">{assinaturasAtivas.length}</b>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <Calculator className="text-blue-500 mb-2" />
            <p className="text-sm text-muted-foreground">
              Receita prevista/mês
            </p>
            <b className="text-3xl">{moeda(receitaPrevista)}</b>
          </div>
        </div>

        <div className="flex gap-2 rounded-2xl border bg-card p-2 w-fit">
          <Button
            variant={aba === "pacotes" ? "default" : "ghost"}
            onClick={() => setAba("pacotes")}
          >
            Modelos de Pacotes
          </Button>
          <Button
            variant={aba === "assinaturas" ? "default" : "ghost"}
            onClick={() => setAba("assinaturas")}
          >
            Assinaturas Ativas
          </Button>
        </div>

        {aba === "pacotes" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {pacotes.length === 0 && (
              <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground lg:col-span-2">
                Nenhum pacote criado.
              </div>
            )}
            {pacotes.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border bg-card p-5 shadow-sm"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{p.nome}</h2>
                    <p className="text-sm text-muted-foreground">
                      {p.descricao}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => abrirPacote(p.id)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => excluirPacote(p.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {p.itens.map((item, i) => {
                    const s = servicos.find(
                      (x: any) => String(x.id) === String(item.servicoId),
                    );
                    return (
                      <div
                        key={i}
                        className="flex justify-between rounded-xl bg-secondary/60 p-3 text-sm"
                      >
                        <span>
                          {s?.nome || "Serviço"} × {item.quantidade}/mês
                        </span>
                        <b>{moeda((s?.valor || 0) * item.quantidade)}</b>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 border-t pt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground line-through">
                      {moeda(p.valorOriginal)}
                    </p>
                    <p className="text-sm text-emerald-500">
                      Desconto{" "}
                      {moeda(Math.max(0, p.valorOriginal - p.valorFinal))}
                    </p>
                  </div>
                  <b className="text-3xl text-primary">{moeda(p.valorFinal)}</b>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {assinaturas.length === 0 && (
              <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
                Nenhuma assinatura.
              </div>
            )}
            {assinaturas.map((a) => {
              const p = pacotes.find(
                (x) => String(x.id) === String(a.pacoteId),
              );
              return (
                <div key={a.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <b className="text-lg">{a.clienteNome}</b>
                      <p className="text-xs text-muted-foreground">
                        {a.telefone}
                      </p>
                      <p className="mt-1">
                        {p?.nome}{" "}
                        <span className="text-primary font-bold">
                          {moeda(p?.valorFinal || 0)}
                        </span>
                      </p>
                      {a.gerarAgenda && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <CalendarClock className="mr-1 inline h-3 w-3" />{" "}
                          {a.diaSemana} às {a.hora} •{" "}
                          {a.profissionalNome || "Profissional"} •{" "}
                          {p?.itens?.length ? `${p.itens.length} tipo(s) de serviço` : a.servicoNome || "Serviço"} •{" "}
                          {a.agendamentosGerados || 0} agenda(s)
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:flex gap-2 text-sm">
                      <span className="rounded-full bg-primary/15 text-primary px-3 py-2 text-center">
                        {a.status}
                      </span>
                      <span
                        className={`rounded-full px-3 py-2 text-center ${a.pago ? "bg-emerald-500/15 text-emerald-500" : "bg-orange-500/15 text-orange-500"}`}
                      >
                        {a.pago ? "Pago" : "Em aberto"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!a.pago && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirAssinatura(a)}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          atualizarAssinatura(
                            a,
                            a.status === "Pausada" ? "Ativa" : "Pausada",
                          )
                        }
                      >
                        <PauseCircle className="w-4 h-4 mr-1" />
                        Pausar/Ativar
                      </Button>
                      {!a.pago && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => receberAssinatura(a)}
                        >
                          <CreditCard className="w-4 h-4 mr-1" />
                          Receber
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => renovarAssinatura(a)}
                      >
                        <CalendarClock className="w-4 h-4 mr-1" />
                        Renovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => excluirAssinatura(a.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Período: {dataBR(a.inicio)} até {dataBR(a.vencimento)}
                  </p>
                  {a.saldos && a.saldos.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                      {a.saldos.map((s) => (
                        <div key={s.servicoId} className="rounded-xl bg-secondary/60 p-3 text-xs">
                          <b>{s.servicoNome}</b>
                          <div className="mt-1 text-muted-foreground">
                            Saldo: {s.saldo}/{s.contratado} • usado {s.utilizado}
                          </div>
                          <div className="text-muted-foreground">
                            Valor proporcional: {moeda(s.valorUnitarioProporcional)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalPacote && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div className="bg-card border rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-auto">
            <div className="p-5 border-b flex justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {editPacote ? "Editar Pacote" : "Novo Pacote"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Adicione serviços, quantidades e desconto final.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setModalPacote(false)}>
                <X />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <input
                className="w-full rounded-xl border bg-background p-3"
                placeholder="Nome do pacote"
                value={formPacote.nome}
                onChange={(e) =>
                  setFormPacote({ ...formPacote, nome: e.target.value })
                }
              />
              <textarea
                className="w-full rounded-xl border bg-background p-3"
                placeholder="Descrição"
                value={formPacote.descricao}
                onChange={(e) =>
                  setFormPacote({ ...formPacote, descricao: e.target.value })
                }
              />
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <b>Serviços do pacote</b>
                  <Button size="sm" onClick={addItem}>
                    Adicionar serviço
                  </Button>
                </div>
                {formPacote.itens.map((item, idx) => {
                  const s = servicos.find(
                    (x: any) => String(x.id) === String(item.servicoId),
                  );
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_40px] gap-2"
                    >
                      <select
                        className="rounded-xl border bg-background p-3"
                        value={item.servicoId}
                        onChange={(e) =>
                          setFormPacote((f) => ({
                            ...f,
                            itens: f.itens.map((it, i) =>
                              i === idx
                                ? { ...it, servicoId: e.target.value }
                                : it,
                            ),
                          }))
                        }
                      >
                        {servicos.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.nome} - {moeda(s.valor)}
                          </option>
                        ))}
                      </select>
                      <input
                        className="rounded-xl border bg-background p-3"
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) =>
                          setFormPacote((f) => ({
                            ...f,
                            itens: f.itens.map((it, i) =>
                              i === idx
                                ? { ...it, quantidade: Number(e.target.value) }
                                : it,
                            ),
                          }))
                        }
                      />
                      <div className="rounded-xl border bg-secondary/50 p-3 text-right font-bold">
                        {moeda((s?.valor || 0) * item.quantidade)}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setFormPacote((f) => ({
                            ...f,
                            itens: f.itens.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Total normal</p>
                  <b>{moeda(totalOriginal)}</b>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">
                    Valor final com desconto
                  </p>
                  <input
                    className="w-full bg-transparent text-xl font-bold outline-none"
                    type="number"
                    value={formPacote.valorFinal}
                    onChange={(e) =>
                      setFormPacote({
                        ...formPacote,
                        valorFinal: e.target.value,
                      })
                    }
                    placeholder={String(totalOriginal)}
                  />
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Desconto</p>
                  <b className="text-emerald-500">{moeda(desconto)}</b>
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalPacote(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarPacote}>Salvar Pacote</Button>
            </div>
          </div>
        </div>
      )}

      {modalAssinatura && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
          <div className="bg-card border rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b flex justify-between">
              <h2 className="text-2xl font-bold">
                {editAssinatura ? "Editar Assinatura" : "Nova Assinatura"}
              </h2>
              <Button variant="ghost" onClick={() => setModalAssinatura(false)}>
                <X />
              </Button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <select
                className="w-full rounded-xl border bg-background p-3"
                value={formAssinatura.pacoteId}
                onChange={(e) =>
                  setFormAssinatura({
                    ...formAssinatura,
                    pacoteId: e.target.value,
                  })
                }
              >
                <option value="">Selecione o pacote</option>
                {pacotes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} - {moeda(p.valorFinal)}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border bg-background p-3"
                value={formAssinatura.clienteId}
                onChange={(e) =>
                  setFormAssinatura({
                    ...formAssinatura,
                    clienteId: e.target.value,
                  })
                }
              >
                <option value="">Selecione o cliente</option>
                {clientes.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  className="rounded-xl border bg-background p-3"
                  value={formAssinatura.inicio}
                  onChange={(e) =>
                    setFormAssinatura({
                      ...formAssinatura,
                      inicio: e.target.value,
                    })
                  }
                />
                <input
                  type="date"
                  className="rounded-xl border bg-background p-3"
                  value={formAssinatura.vencimento}
                  onChange={(e) =>
                    setFormAssinatura({
                      ...formAssinatura,
                      vencimento: e.target.value,
                    })
                  }
                />
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 space-y-3">
                <label className="flex gap-2 items-center font-bold">
                  <input
                    type="checkbox"
                    checked={formAssinatura.gerarAgenda}
                    onChange={(e) =>
                      setFormAssinatura({
                        ...formAssinatura,
                        gerarAgenda: e.target.checked,
                      })
                    }
                  />{" "}
                  Gerar agenda automaticamente quando pagar
                </label>
                {formAssinatura.gerarAgenda && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      className="rounded-xl border bg-background p-3"
                      value={formAssinatura.profissionalId}
                      onChange={(e) =>
                        setFormAssinatura({
                          ...formAssinatura,
                          profissionalId: e.target.value,
                        })
                      }
                    >
                      <option value="">Profissional</option>
                      {profissionais.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                    {nomesServicosPacoteSelecionado.length > 0 && (
                      <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground md:col-span-2">
                        <b>Serviço(s) do pacote:</b>{" "}
                        {nomesServicosPacoteSelecionado.join(" + ")}
                      </div>
                    )}
                    <select
                      className="rounded-xl border bg-background p-3"
                      value={formAssinatura.diaSemana}
                      onChange={(e) =>
                        setFormAssinatura({
                          ...formAssinatura,
                          diaSemana: e.target.value,
                        })
                      }
                    >
                      {diasSemana.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      className="rounded-xl border bg-background p-3"
                      value={formAssinatura.hora}
                      onChange={(e) =>
                        setFormAssinatura({
                          ...formAssinatura,
                          hora: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Assinatura em aberto não entra na agenda. Quando receber, o
                  sistema gera automaticamente os horários pagos na agenda.
                </p>
              </div>
              <label className="flex gap-2 items-center rounded-xl border p-3">
                <input
                  type="checkbox"
                  checked={formAssinatura.pago}
                  onChange={(e) =>
                    setFormAssinatura({
                      ...formAssinatura,
                      pago: e.target.checked,
                    })
                  }
                />{" "}
                Já foi pago
              </label>
              {formAssinatura.pago && (
                <select
                  className="w-full rounded-xl border bg-background p-3"
                  value={formAssinatura.formaPagamento}
                  onChange={(e) =>
                    setFormAssinatura({
                      ...formAssinatura,
                      formaPagamento: e.target.value as FormaPagamento,
                    })
                  }
                >
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Débito">Débito</option>
                  <option value="Crédito">Crédito</option>
                </select>
              )}
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-muted-foreground">
                Se ficar em aberto, não agenda agora. Se marcar como pago,
                agenda agora e lança no fluxo de caixa.
              </div>
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setModalAssinatura(false)}
              >
                Cancelar
              </Button>
              <Button onClick={salvarAssinatura}>
                {editAssinatura ? "Salvar Alterações" : "Salvar Assinatura"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
