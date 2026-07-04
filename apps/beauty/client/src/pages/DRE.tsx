import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownCircle, BarChart3, DollarSign, FileText, Printer, TrendingUp } from "lucide-react";

import { useBarbearia } from "@/contexts/BarbeariaContext";
import { PageShell, SummaryCard } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const moeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor || 0));

type Despesa = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  forma: string;
  fornecedor?: string;
  status: "Pendente" | "Pago" | "Vencido" | string;
  observacao?: string;
};

type Movimento = {
  id: string;
  tipo: "Entrada" | "Saída" | string;
  descricao: string;
  categoria: string;
  valor: number;
  valorBruto?: number;
  taxaPercentual?: number;
  valorTaxa?: number;
  valorLiquido?: number;
  data: string;
  forma: string;
  status: "Pago" | "Pendente" | string;
};

async function api(path: string) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" } });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false) throw new Error(json?.error || "Erro na API");
  return json?.data;
}

function dataParaISO(data: string) {
  if (!data) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [d, m, y] = data.split("/");
    return `${y}-${m}-${d}`;
  }
  return String(data).slice(0, 10);
}

function dentroPeriodo(data: string, inicio: string, fim: string) {
  const iso = dataParaISO(data);
  if (!iso) return true;
  if (inicio && iso < inicio) return false;
  if (fim && iso > fim) return false;
  return true;
}

function mesAno(data: string) {
  const iso = dataParaISO(data);
  if (!iso) return "Sem data";
  const [ano, mes] = iso.split("-");
  return `${mes}/${ano}`;
}

function texto(item: any) {
  return String(`${item?.categoria || ""} ${item?.origem || ""} ${item?.descricao || ""}`).toLowerCase();
}

function ehComissao(item: any) {
  return texto(item).includes("comiss");
}

function ehProduto(item: any) {
  return texto(item).includes("produto");
}

function ehEstornoDespesa(item: any) {
  return texto(item).includes("estorno de despesa");
}

function linha(classe: string, descricao: string, valor: number, destaque = false) {
  return { classe, descricao, valor, destaque };
}

export default function DRE() {
  const { agendamentos, profissionais } = useBarbearia() as any;

  const hoje = new Date().toISOString().slice(0, 10);
  const primeiroDia = hoje.slice(0, 8) + "01";

  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [fluxo, setFluxo] = useState<Movimento[]>([]);
  const [erro, setErro] = useState("");
  const [filtros, setFiltros] = useState({
    inicio: primeiroDia,
    fim: hoje,
    profissionalId: "todos",
  });

  useEffect(() => {
    Promise.all([api("/api/despesas").catch(() => []), api("/api/fluxo-caixa").catch(() => [])])
      .then(([d, f]) => {
        setDespesas(d || []);
        setFluxo(f || []);
      })
      .catch((e) => setErro(e?.message || "Erro ao carregar DRE."));
  }, []);

  const agendamentosFiltrados = useMemo(() => {
    return (agendamentos || []).filter((a: any) => {
      if (!dentroPeriodo(a.data, filtros.inicio, filtros.fim)) return false;
      if (filtros.profissionalId !== "todos" && String(a.profissionalId) !== filtros.profissionalId) return false;
      return true;
    });
  }, [agendamentos, filtros]);

  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      if (!dentroPeriodo(d.data, filtros.inicio, filtros.fim)) return false;
      if (filtros.profissionalId !== "todos") {
        const prof = profissionais.find((p: any) => String(p.id) === filtros.profissionalId);
        if (prof && !`${d.descricao} ${d.fornecedor || ""} ${d.observacao || ""}`.toLowerCase().includes(String(prof.nome).toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [despesas, filtros, profissionais]);

  const fluxoFiltrado = useMemo(() => fluxo.filter((m) => dentroPeriodo(m.data, filtros.inicio, filtros.fim)), [fluxo, filtros]);

  const realizados = agendamentosFiltrados.filter((a: any) => ["Realizado", "Finalizado"].includes(a.status));
  const entradasPagas = fluxoFiltrado.filter((m) => m.tipo === "Entrada" && m.status === "Pago" && !ehEstornoDespesa(m));
  const saidasPagas = fluxoFiltrado.filter((m) => m.tipo === "Saída" && m.status === "Pago");

  const receitaAgendamentos = realizados.reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
  const entradasServicos = entradasPagas.filter((m) => !ehProduto(m));
  const entradasProdutos = entradasPagas.filter(ehProduto);

  const receitaProdutos = entradasProdutos.reduce(
    (s, m) => s + Number(m.valorBruto ?? m.valor ?? 0),
    0,
  );
  const receitaServicos = entradasPagas.length
    ? entradasServicos.reduce((s, m) => s + Number(m.valorBruto ?? m.valor ?? 0), 0)
    : receitaAgendamentos;

  const receitaBruta = receitaServicos + receitaProdutos;
  const taxasCartao = entradasPagas.reduce((s, m) => s + Number(m.valorTaxa || 0), 0);
  const descontos = Math.abs(
    saidasPagas.filter((m) => texto(m).includes("desconto") || texto(m).includes("estorno")).reduce((s, m) => s + Number(m.valor || 0), 0),
  );
  const receitaLiquida = receitaBruta - taxasCartao - descontos;

  const ehTaxaCartao = (item: any) => {
    const t = texto(item);
    return (
      t.includes("taxa") ||
      t.includes("cartao") ||
      t.includes("cartão") ||
      t.includes("maquininha") ||
      t.includes("operadora")
    );
  };

  const comissoesPagas = despesasFiltradas.filter((d) => d.status === "Pago" && ehComissao(d)).reduce((s, d) => s + Number(d.valor || 0), 0);
  const comissoesPendentes = despesasFiltradas.filter((d) => d.status === "Pendente" && ehComissao(d)).reduce((s, d) => s + Number(d.valor || 0), 0);
  const despesasOperacionais = despesasFiltradas
    .filter((d) => d.status === "Pago" && !ehComissao(d) && !ehTaxaCartao(d))
    .reduce((s, d) => s + Number(d.valor || 0), 0);
  const resultadoOperacional = receitaLiquida - despesasOperacionais - comissoesPagas;

  const linhasDre = [
    linha("Receitas", "Receita de serviços", receitaServicos),
    linha("Receitas", "Receita de produtos", receitaProdutos),
    linha("Receitas", "Receita bruta", receitaBruta, true),
    linha("Deduções", "(-) Taxas de cartão", taxasCartao),
    linha("Deduções", "(-) Descontos / estornos", descontos),
    linha("Resultado", "Receita líquida", receitaLiquida, true),
    linha("Custos", "(-) Comissões pagas", comissoesPagas),
    linha("Custos", "(-) Despesas operacionais", despesasOperacionais),
    linha("Resultado", "Resultado operacional", resultadoOperacional, true),
  ];

  const graficoMensal = useMemo(() => {
    const mapa = new Map<string, { mes: string; receitas: number; despesas: number; resultado: number }>();

    entradasPagas.forEach((m) => {
      const chave = mesAno(m.data);
      const atual = mapa.get(chave) || { mes: chave, receitas: 0, despesas: 0, resultado: 0 };
      atual.receitas += Number(m.valorLiquido ?? m.valor ?? 0);
      atual.resultado = atual.receitas - atual.despesas;
      mapa.set(chave, atual);
    });

    despesasFiltradas.filter((d) => d.status === "Pago" && !ehTaxaCartao(d)).forEach((d) => {
      const chave = mesAno(d.data);
      const atual = mapa.get(chave) || { mes: chave, receitas: 0, despesas: 0, resultado: 0 };
      atual.despesas += Number(d.valor || 0);
      atual.resultado = atual.receitas - atual.despesas;
      mapa.set(chave, atual);
    });

    return Array.from(mapa.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [entradasPagas, despesasFiltradas]);

  const limparFiltros = () => setFiltros({ inicio: primeiroDia, fim: hoje, profissionalId: "todos" });

  return (
    <PageShell title="DRE" subtitle="Demonstrativo do Resultado do Exercício com receitas, despesas, comissões e resultado operacional.">
      <div className="space-y-5">
        <div className="rounded-2xl border bg-card p-4 shadow-sm print:hidden">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="font-bold">Filtros da DRE</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={limparFiltros}>Limpar</Button>
              <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
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
              <select className="w-full rounded-xl border bg-background p-3" value={filtros.profissionalId} onChange={(e) => setFiltros({ ...filtros, profissionalId: e.target.value })}>
                <option value="todos">Todos</option>
                {(profissionais || []).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          </div>
          {erro && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Receita bruta" value={moeda(receitaBruta)} icon={<DollarSign className="h-5 w-5" />} tone="green" />
          <SummaryCard title="Despesas + comissões" value={moeda(despesasOperacionais + comissoesPagas)} icon={<ArrowDownCircle className="h-5 w-5" />} tone="red" />
          <SummaryCard title="Comissões pendentes" value={moeda(comissoesPendentes)} icon={<FileText className="h-5 w-5" />} tone="amber" />
          <SummaryCard title="Resultado" value={moeda(resultadoOperacional)} icon={<TrendingUp className="h-5 w-5" />} tone="primary" />
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">DRE Gerencial</h2>
              <p className="text-sm text-muted-foreground">Período: {filtros.inicio || "início"} até {filtros.fim || "hoje"}</p>
            </div>
            <BarChart3 className="h-7 w-7 text-primary" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="px-3 py-2">Grupo</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {linhasDre.map((item) => (
                  <tr key={`${item.classe}-${item.descricao}`} className={item.destaque ? "bg-primary/10 font-black" : "bg-secondary/40"}>
                    <td className="rounded-l-xl px-3 py-3 text-sm text-muted-foreground">{item.classe}</td>
                    <td className="px-3 py-3">{item.descricao}</td>
                    <td className={`rounded-r-xl px-3 py-3 text-right ${item.valor < 0 ? "text-red-500" : ""}`}>{moeda(item.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm print:hidden">
          <h2 className="mb-4 text-lg font-bold">Resultado mensal</h2>
          {graficoMensal.length ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoMensal} margin={{ left: 0, right: 8, top: 8, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => moeda(Number(v))} />
                  <Bar dataKey="receitas" name="Receitas" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="resultado" name="Resultado" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-8 text-center text-muted-foreground">Sem dados no período.</p>}
        </div>
      </div>
    </PageShell>
  );
}
