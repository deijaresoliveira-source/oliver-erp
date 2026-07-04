import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  Copy,
  Edit,
  ExternalLink,
  Eye,
  Lock,
  Plus,
  RefreshCcw,
  RotateCw,
  Save,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BOTAO_PRIMARIO =
  "border border-[#f6b21a]/40 bg-[#f6b21a] text-[#070b12] font-bold hover:bg-[#ffd76a] hover:text-[#070b12]";

const BOTAO_SECUNDARIO =
  "border border-white/15 bg-white/[0.06] text-slate-100 hover:bg-white/12 hover:text-[#f6b21a]";

const BOTAO_PERIGO =
  "border border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20 hover:text-red-100";

const CAMPO_ESCURO =
  "border-white/10 bg-[#111827] text-white placeholder:text-slate-500 focus:border-[#f6b21a]";

const SELECT_ESCURO =
  "w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white focus:border-[#f6b21a] focus:outline-none";



async function api(path: string, options: RequestInit = {}) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.ok === false) throw new Error(j?.error || "Erro na API");
  return j?.data;
}

type Empresa = {
  id: string;
  nome: string;
  slug: string;
  email?: string;
  telefone?: string;
  sistemaTipo?: string;
  sistema_tipo?: string;
  sistemaNome?: string;
  plano?: string;
  ativo?: boolean;
  ativaAte?: string;
  diasAviso?: number;
  bloqueioMotivo?: string;
  logoEmpresa?: string;
  logoMenu?: string;
  fundoLogin?: string;
  corPrimaria?: string;
  usuariosTotal?: number;
  clientesTotal?: number;
  agendamentosTotal?: number;
  diasRestantes?: number | null;
  statusComercial?: string;
};

const formInicial = {
  id: "",
  nome: "",
  slug: "",
  email: "",
  telefone: "",
  sistemaTipo: "beauty",
  plano: "Teste",
  ativo: true,
  ativaAte: "",
  diasAviso: "7",
  bloqueioMotivo: "",
  adminNome: "",
  adminEmail: "",
  adminSenha: "",
  logoEmpresa: "",
  logoMenu: "",
  fundoLogin: "",
  corPrimaria: "#f6b21a",
};

function slugify(v: string) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .trim();
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function somarDias(dataIso: string, dias: number) {
  const base = dataIso ? new Date(`${dataIso}T12:00:00`) : new Date();
  base.setDate(base.getDate() + dias);
  return base.toISOString().slice(0, 10);
}

function dataBR(data?: string) {
  if (!data) return "Sem vencimento";
  const iso = String(data).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return data;
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function statusEmpresa(e: Empresa) {
  if (!e.ativo) return { texto: "Bloqueada", classe: "bg-red-500/15 text-red-100 border-red-400/30" };
  if (e.diasRestantes !== null && e.diasRestantes !== undefined) {
    if (e.diasRestantes < 0) return { texto: "Vencida", classe: "bg-red-500/15 text-red-100 border-red-400/30" };
    if (e.diasRestantes <= 3) return { texto: `Vence em ${e.diasRestantes} dia(s)`, classe: "bg-orange-500/20 text-orange-100 border-orange-400/40" };
    if (e.diasRestantes <= Number(e.diasAviso || 7)) return { texto: `Vence em ${e.diasRestantes} dia(s)`, classe: "bg-amber-500/20 text-amber-100 border-amber-400/40" };
  }
  return { texto: "Ativa", classe: "bg-emerald-500/20 text-emerald-100 border-emerald-400/40" };
}

function arquivoImagemParaDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Selecione apenas imagens."));
    if (file.size > 2 * 1024 * 1024) return reject(new Error("A imagem deve ter no máximo 2 MB."));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Erro ao carregar imagem."));
    reader.readAsDataURL(file);
  });
}

export default function AdminMaster() {
  const [master, setMaster] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem("@sistema_saas_master") || "null");
    } catch {
      return null;
    }
  });
  const [login, setLogin] = useState({ email: "deijares@gmail.com", senha: "" });
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({
    ...formInicial,
    nome: "LetsBarbearia",
    slug: "letsbarbearia",
    email: "deijares@gmail.com",
    sistemaTipo: "beauty",
    adminNome: "DEIJARES OLIVEIRA",
    adminEmail: "deijares@gmail.com",
    adminSenha: "130312",
    ativaAte: somarDias(hojeISO(), 30),
  });

  const resumo = useMemo(() => {
    const ativas = empresas.filter((e) => e.ativo && !(Number(e.diasRestantes) < 0)).length;
    const vencendo = empresas.filter((e) => e.ativo && e.diasRestantes !== null && e.diasRestantes !== undefined && e.diasRestantes >= 0 && e.diasRestantes <= Number(e.diasAviso || 7)).length;
    const bloqueadas = empresas.filter((e) => !e.ativo || Number(e.diasRestantes) < 0).length;
    return { ativas, vencendo, bloqueadas };
  }, [empresas]);

  const carregar = async () => {
    const dados = await api("/api/master/empresas");
    setEmpresas(dados || []);
  };

  useEffect(() => {
    if (master) carregar().catch(() => undefined);
  }, [master]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    const dados = await api("/api/master/login", { method: "POST", body: JSON.stringify(login) });
    localStorage.setItem("@sistema_saas_master", JSON.stringify(dados));
    setMaster(dados);
  };

  const abrirNovo = () => {
    setForm({
      ...formInicial,
      nome: "",
      slug: "",
      sistemaTipo: "beauty",
      plano: "Teste",
      ativo: true,
      diasAviso: "7",
      ativaAte: somarDias(hojeISO(), 30),
      corPrimaria: "#f6b21a",
    });
    setModalAberto(true);
  };

  const abrirEditar = (e: Empresa) => {
    setForm({
      ...formInicial,
      id: e.id,
      nome: e.nome || "",
      slug: e.slug || "",
      email: e.email || "",
      telefone: e.telefone || "",
      sistemaTipo: e.sistemaTipo || e.sistema_tipo || "beauty",
      plano: e.plano || "Teste",
      ativo: Boolean(e.ativo),
      ativaAte: e.ativaAte ? String(e.ativaAte).slice(0, 10) : "",
      diasAviso: String(e.diasAviso || 7),
      bloqueioMotivo: e.bloqueioMotivo || "",
      logoEmpresa: e.logoEmpresa || "",
      logoMenu: e.logoMenu || "",
      fundoLogin: e.fundoLogin || "",
      corPrimaria: e.corPrimaria || "#f6b21a",
      adminNome: "",
      adminEmail: "",
      adminSenha: "",
    });
    setModalAberto(true);
  };

  const salvarEmpresa = async () => {
    if (!form.nome || !form.slug) return alert("Informe nome e slug.");
    const payload = {
      ...form,
      diasAviso: Number(form.diasAviso || 7),
      slug: slugify(form.slug),
    };
    if (form.id) {
      await api(`/api/master/empresas/${form.id}`, { method: "PUT", body: JSON.stringify(payload) });
      alert("Empresa atualizada.");
    } else {
      await api("/api/master/empresas", { method: "POST", body: JSON.stringify(payload) });
      alert("Empresa cadastrada.");
    }
    setModalAberto(false);
    await carregar();
  };

  const bloquear = async (empresa: Empresa) => {
    const motivo = prompt("Motivo do bloqueio:", empresa.bloqueioMotivo || "Bloqueio administrativo.");
    if (motivo === null) return;
    await api(`/api/master/empresas/${empresa.id}/bloquear`, { method: "PUT", body: JSON.stringify({ motivo }) });
    await carregar();
  };

  const reativar = async (empresa: Empresa) => {
    const ativaAte = prompt("Nova data de vencimento (AAAA-MM-DD):", empresa.ativaAte || somarDias(hojeISO(), 30));
    if (ativaAte === null) return;
    await api(`/api/master/empresas/${empresa.id}/reativar`, { method: "PUT", body: JSON.stringify({ ativaAte }) });
    await carregar();
  };

  const renovar = async (empresa: Empresa, dias: number) => {
    await api(`/api/master/empresas/${empresa.id}/renovar`, { method: "PUT", body: JSON.stringify({ dias }) });
    await carregar();
  };

  const inativar = async (empresa: Empresa) => {
    if (!confirm(`Inativar/excluir a empresa ${empresa.nome}?`)) return;
    await api(`/api/master/empresas/${empresa.id}`, { method: "DELETE" });
    await carregar();
  };

  const selecionarImagem = async (campo: "logoEmpresa" | "logoMenu" | "fundoLogin", file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await arquivoImagemParaDataUrl(file);
      setForm((f) => ({ ...f, [campo]: dataUrl }));
    } catch (e: any) {
      alert(e.message || "Erro ao carregar imagem.");
    }
  };

  const origemSistema = typeof window !== "undefined" ? window.location.origin : "";

  const linkPorSlug = (slug?: string, destino: "login" | "agendar" | "inicio" = "login") => {
    const slugLimpo = slugify(slug || "");
    if (!slugLimpo) return origemSistema || "/";
    if (destino === "agendar") return `${origemSistema}/${slugLimpo}/agendar`;
    if (destino === "inicio") return `${origemSistema}/${slugLimpo}/`;
    return `${origemSistema}/${slugLimpo}/login`;
  };

  const abrirLink = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copiarLink = async (url: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copiado.");
    } catch {
      const campo = document.createElement("textarea");
      campo.value = url;
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.focus();
      campo.select();
      document.execCommand("copy");
      document.body.removeChild(campo);
      alert("Link copiado.");
    }
  };

  if (!master) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b12] p-4 text-white">
        <form onSubmit={entrar} className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f6b21a]/20 text-[#f6b21a]"><Lock /></div>
            <div>
              <h1 className="text-2xl font-black">Admin Master</h1>
              <p className="text-sm text-slate-300">DBO Sistema SaaS</p>
            </div>
          </div>
          <div className="space-y-3">
            <div><Label>E-mail</Label><Input className={CAMPO_ESCURO} value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} /></div>
            <div><Label>Senha</Label><Input className={CAMPO_ESCURO} type="password" value={login.senha} onChange={(e) => setLogin({ ...login, senha: e.target.value })} /></div>
            <Button className={`w-full ${BOTAO_PRIMARIO}`} type="submit">Entrar</Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b12] p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black">Painel Master</h1>
            <p className="text-slate-300">Cadastre empresas, controle vencimentos, bloqueios e acessos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className={BOTAO_PRIMARIO} onClick={abrirNovo}><Plus className="mr-2 h-4 w-4" />Nova empresa</Button>
            <Button className={BOTAO_SECUNDARIO} variant="outline" onClick={carregar}><RefreshCcw className="mr-2 h-4 w-4" />Atualizar</Button>
            <Button className={BOTAO_PERIGO} variant="outline" onClick={() => { localStorage.removeItem("@sistema_saas_master"); setMaster(null); }}>Sair</Button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black">Atalhos Rápidos</h2>
              <p className="text-sm text-slate-400">Acesse ou copie os links principais do Oliver ERP.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-bold text-white">Cadastrar empresa</p>
              <p className="mt-1 break-all text-xs text-slate-400">{`${origemSistema}/cadastrar-empresa`}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button className={BOTAO_PRIMARIO} size="sm" onClick={() => abrirLink(`${origemSistema}/cadastrar-empresa`)}><ExternalLink className="mr-2 h-4 w-4" />Abrir</Button>
                <Button className={BOTAO_SECUNDARIO} size="sm" variant="outline" onClick={() => copiarLink(`${origemSistema}/cadastrar-empresa`)}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-bold text-white">Agendamento público geral</p>
              <p className="mt-1 break-all text-xs text-slate-400">{`${origemSistema}/agendar`}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button className={BOTAO_PRIMARIO} size="sm" onClick={() => abrirLink(`${origemSistema}/agendar`)}><ExternalLink className="mr-2 h-4 w-4" />Abrir</Button>
                <Button className={BOTAO_SECUNDARIO} size="sm" variant="outline" onClick={() => copiarLink(`${origemSistema}/agendar`)}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-bold text-white">Admin Master</p>
              <p className="mt-1 break-all text-xs text-slate-400">{`${origemSistema}/admin`}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button className={BOTAO_PRIMARIO} size="sm" onClick={() => abrirLink(`${origemSistema}/admin`)}><ExternalLink className="mr-2 h-4 w-4" />Abrir</Button>
                <Button className={BOTAO_SECUNDARIO} size="sm" variant="outline" onClick={() => copiarLink(`${origemSistema}/admin`)}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-100">Empresas ativas</p>
            <p className="mt-2 text-3xl font-black">{resumo.ativas}</p>
          </div>
          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-100">Empresas vencendo</p>
            <p className="mt-2 text-3xl font-black">{resumo.vencendo}</p>
          </div>
          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5">
            <p className="text-sm text-red-100">Bloqueadas/vencidas</p>
            <p className="mt-2 text-3xl font-black">{resumo.bloqueadas}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.04]">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-white/[0.08] text-slate-100">
              <tr>
                <th className="p-4 text-left">Empresa</th>
                <th className="p-4 text-left">URL</th>
                <th className="p-4">Sistema</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Vencimento</th>
                <th className="p-4">Status</th>
                <th className="p-4">Clientes</th>
                <th className="p-4">Agendamentos</th>
                <th className="p-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((empresa) => {
                const status = statusEmpresa(empresa);
                return (
                  <tr key={empresa.id} className="border-t border-white/10 align-middle text-slate-100 hover:bg-white/[0.03]">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                          {empresa.logoEmpresa ? <img src={empresa.logoEmpresa} className="h-full w-full object-contain" /> : <Building2 className="h-5 w-5 text-[#f6b21a]" />}
                        </div>
                        <div>
                          <p className="font-bold">{empresa.nome}</p>
                          <p className="text-xs text-slate-400">{empresa.email || "Sem e-mail"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">
                      <div className="max-w-[320px] break-all text-xs md:text-sm">{linkPorSlug(empresa.slug, "login")}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button className={BOTAO_SECUNDARIO} size="sm" variant="outline" onClick={() => abrirLink(linkPorSlug(empresa.slug, "login"))}>
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />Abrir
                        </Button>
                        <Button className={BOTAO_SECUNDARIO} size="sm" variant="outline" onClick={() => copiarLink(linkPorSlug(empresa.slug, "login"))}>
                          <Copy className="mr-1 h-3.5 w-3.5" />Copiar
                        </Button>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="rounded-full border border-[#f6b21a]/30 bg-[#f6b21a]/10 px-3 py-1 text-xs font-black text-[#f6b21a]">
                        {empresa.sistemaNome || (empresa.sistemaTipo === "fit" ? "Oliver Fit" : empresa.sistemaTipo === "clinic" ? "Oliver Clinic" : "Oliver Beauty")}
                      </span>
                    </td>
                    <td className="p-4 text-center">{empresa.plano}</td>
                    <td className="p-4 text-center">
                      <div>{dataBR(empresa.ativaAte)}</div>
                      {empresa.diasRestantes !== null && empresa.diasRestantes !== undefined && <div className="text-xs text-slate-400">{empresa.diasRestantes >= 0 ? `${empresa.diasRestantes} dia(s)` : "Vencida"}</div>}
                    </td>
                    <td className="p-4 text-center"><span className={`rounded-full border px-3 py-1 text-xs font-bold ${status.classe}`}>{status.texto}</span></td>
                    <td className="p-4 text-center">{empresa.clientesTotal}</td>
                    <td className="p-4 text-center">{empresa.agendamentosTotal}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button className={BOTAO_SECUNDARIO} size="sm" variant="outline" onClick={() => abrirEditar(empresa)} title="Editar"><Edit className="h-4 w-4" /></Button>
                        {empresa.ativo ? (
                          <Button className={BOTAO_PERIGO} size="sm" variant="outline" onClick={() => bloquear(empresa)} title="Bloquear"><Lock className="h-4 w-4" /></Button>
                        ) : (
                          <Button className={BOTAO_SECUNDARIO} size="sm" variant="outline" onClick={() => reativar(empresa)} title="Reativar"><Unlock className="h-4 w-4" /></Button>
                        )}
                        <Button className={BOTAO_SECUNDARIO} size="sm" variant="outline" onClick={() => renovar(empresa, 30)} title="Renovar 30 dias"><RotateCw className="h-4 w-4" /></Button>
                        <Button className={BOTAO_PRIMARIO} size="sm" onClick={() => abrirLink(linkPorSlug(empresa.slug, "login"))} title="Abrir login"><Eye className="h-4 w-4" /></Button>
                        <Button className={BOTAO_SECUNDARIO} size="sm" variant="outline" onClick={() => copiarLink(linkPorSlug(empresa.slug, "login"))} title="Copiar link"><Copy className="h-4 w-4" /></Button>
                        <Button className={BOTAO_PERIGO} size="sm" variant="outline" onClick={() => inativar(empresa)} title="Inativar"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!empresas.length && <tr><td colSpan={9} className="p-8 text-center text-slate-400">Nenhuma empresa cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0b1220] p-5 text-white shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">{form.id ? "Editar empresa" : "Nova empresa"}</h2>
                <p className="text-sm text-slate-400">Configure acesso, vencimento e identidade visual.</p>
              </div>
              <Button className={BOTAO_SECUNDARIO} variant="outline" size="icon" onClick={() => setModalAberto(false)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div><Label>Nome da empresa</Label><Input className={CAMPO_ESCURO} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value, slug: form.slug || slugify(e.target.value) })} /></div>
              <div><Label>Slug</Label><Input className={CAMPO_ESCURO} value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} /></div>
              <div><Label>Sistema</Label><select className={SELECT_ESCURO} value={form.sistemaTipo} onChange={(e) => setForm({ ...form, sistemaTipo: e.target.value })}><option value="beauty">Oliver Beauty</option><option value="fit">Oliver Fit</option><option value="clinic">Oliver Clinic</option></select></div>
              <div><Label>Plano</Label><select className={SELECT_ESCURO} value={form.plano} onChange={(e) => setForm({ ...form, plano: e.target.value })}><option>Teste</option><option>Mensal</option><option>Trimestral</option><option>Semestral</option><option>Anual</option></select></div>
              <div><Label>E-mail</Label><Input className={CAMPO_ESCURO} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input className={CAMPO_ESCURO} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>Cor principal</Label><Input className={CAMPO_ESCURO} type="color" value={form.corPrimaria} onChange={(e) => setForm({ ...form, corPrimaria: e.target.value })} /></div>
              <div><Label>Ativa até</Label><Input className={CAMPO_ESCURO} type="date" value={form.ativaAte} onChange={(e) => setForm({ ...form, ativaAte: e.target.value })} /></div>
              <div><Label>Dias de aviso</Label><Input className={CAMPO_ESCURO} type="number" min="1" value={form.diasAviso} onChange={(e) => setForm({ ...form, diasAviso: e.target.value })} /></div>
              <label className="mt-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Empresa ativa</label>
              <div className="md:col-span-3"><Label>Motivo do bloqueio/observação</Label><Input className={CAMPO_ESCURO} value={form.bloqueioMotivo} onChange={(e) => setForm({ ...form, bloqueioMotivo: e.target.value })} /></div>
            </div>

            {!form.id && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex items-center gap-2 font-bold"><Lock className="h-4 w-4 text-[#f6b21a]" /> Administrador da empresa</div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div><Label>Nome admin</Label><Input className={CAMPO_ESCURO} value={form.adminNome} onChange={(e) => setForm({ ...form, adminNome: e.target.value })} /></div>
                  <div><Label>E-mail admin</Label><Input className={CAMPO_ESCURO} value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></div>
                  <div><Label>Senha inicial</Label><Input className={CAMPO_ESCURO} value={form.adminSenha} onChange={(e) => setForm({ ...form, adminSenha: e.target.value })} /></div>
                </div>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2 font-bold"><CalendarClock className="h-4 w-4 text-[#f6b21a]" /> Identidade visual</div>
              <div className="grid gap-4 md:grid-cols-3">
                {([
                  ["logoEmpresa", "Logo da empresa"],
                  ["logoMenu", "Logo do menu"],
                  ["fundoLogin", "Fundo do login"],
                ] as const).map(([campo, label]) => (
                  <div key={campo} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <Label>{label}</Label>
                    <div className="mt-2 flex h-24 items-center justify-center rounded-xl bg-black/20 p-2">
                      {form[campo] ? <img src={form[campo]} className="max-h-20 max-w-full object-contain" /> : <span className="text-xs text-slate-400">Sem imagem</span>}
                    </div>
                    <Input className={`mt-3 ${CAMPO_ESCURO}`} type="file" accept="image/*" onChange={(e) => selecionarImagem(campo, e.target.files?.[0])} />
                    <Input className={`mt-2 ${CAMPO_ESCURO}`} placeholder="Ou informe uma URL/caminho" value={form[campo]} onChange={(e) => setForm({ ...form, [campo]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 md:flex-row md:justify-end">
              <Button className={BOTAO_SECUNDARIO} variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button className={BOTAO_PRIMARIO} onClick={salvarEmpresa}><Save className="mr-2 h-4 w-4" />Salvar empresa</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
