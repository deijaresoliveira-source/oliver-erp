
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type CadastroResultado = {
  empresaId: string;
  empresaNome: string;
  slug: string;
  linkAcesso: string;
  adminEmail: string;
  ativaAte: string;
};

function limparSlug(texto: string) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function CadastroEmpresa() {
  const [, navigate] = useLocation();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<CadastroResultado | null>(null);

  const [form, setForm] = useState({
    empresaNome: "",
    segmento: "Barbearia",
    sistemaTipo: "beauty",
    documento: "",
    telefone: "",
    email: "",
    cidade: "",
    uf: "",
    responsavelNome: "",
    responsavelEmail: "",
    senha: "",
    confirmarSenha: "",
    aceitarTermos: false,
  });

  const slugPreview = useMemo(() => limparSlug(form.empresaNome), [form.empresaNome]);

  function atualizar(campo: string, valor: any) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();

    if (!form.empresaNome.trim()) return toast.error("Informe o nome da empresa.");
    if (!form.responsavelNome.trim()) return toast.error("Informe o nome do responsável.");
    if (!form.telefone.trim()) return toast.error("Informe o WhatsApp.");
    if (!form.responsavelEmail.trim()) return toast.error("Informe o e-mail de acesso.");
    if (!form.senha) return toast.error("Informe uma senha.");
    if (form.senha.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    if (form.senha !== form.confirmarSenha) return toast.error("As senhas não conferem.");
    if (!form.aceitarTermos) return toast.error("Confirme que está ciente do período de teste.");

    try {
      setCarregando(true);

      const resposta = await fetch("/api/publico/cadastrar-empresa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await resposta.json().catch(() => null);
      if (!resposta.ok || json?.ok === false) {
        throw new Error(json?.error || "Erro ao cadastrar empresa.");
      }

      setResultado(json.data);
      toast.success("Empresa cadastrada com sucesso.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao cadastrar empresa.");
    } finally {
      setCarregando(false);
    }
  }

  if (resultado) {
    return (
      <div className="min-h-screen bg-[#070b12] p-5 text-white">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center">
          <div className="w-full rounded-[2rem] border border-white/10 bg-[#111827] p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl border border-emerald-300/30 bg-emerald-400/10">
              <CheckCircle2 className="h-11 w-11 text-emerald-300" />
            </div>

            <h1 className="text-3xl font-black text-[#f6c24a]">Teste grátis liberado!</h1>
            <p className="mt-4 text-slate-300">Sua empresa foi cadastrada e o acesso está disponível por 7 dias.</p>

            <div className="mt-7 space-y-3 rounded-2xl border border-white/10 bg-black/30 p-5 text-left">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Empresa</p>
                <p className="font-bold text-white">{resultado.empresaNome}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Link de acesso</p>
                <p className="break-all font-bold text-[#f6c24a]">{resultado.linkAcesso}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">E-mail de acesso</p>
                <p className="font-bold text-white">{resultado.adminEmail}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Senha</p>
                <p className="font-bold text-white">A senha cadastrada por você</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Validade do teste</p>
                <p className="font-bold text-white">{resultado.ativaAte}</p>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                className="h-12 flex-1 rounded-xl bg-gradient-to-r from-[#d99b19] via-[#f5c84b] to-[#f7d56b] font-black text-black shadow-[0_18px_45px_rgba(246,194,74,0.22)] hover:brightness-105"
                onClick={() => {
                  window.location.href = resultado.linkAcesso;
                }}
              >
                Acessar sistema
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <Button
                variant="outline"
                className="h-12 flex-1 rounded-xl border-white/20 bg-transparent text-white hover:bg-white/10"
                onClick={() => navigate("/")}
              >
                Voltar
              </Button>
            </div>

            <p className="mt-6 text-xs text-slate-500">
              Após o período de teste, o acesso só será renovado mediante confirmação de pagamento pelo administrador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#05070b] text-white">
      <div className="relative grid min-h-screen lg:grid-cols-[0.85fr_1.15fr]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(246,194,74,0.25),transparent_28%),radial-gradient(circle_at_88%_20%,rgba(255,255,255,0.08),transparent_30%),linear-gradient(135deg,#05070b_0%,#0a1018_48%,#05070b_100%)]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#f6c24a]/10 blur-3xl" />

        <section className="relative z-10 hidden min-h-screen flex-col justify-between p-10 xl:flex xl:p-14 lg:flex">
          <div>
            <div className="mb-10">
              <img
                src="/oliver-erp-login.png"
                alt="OLIVER ERP"
                className="w-full max-w-[430px] object-contain drop-shadow-2xl"
              />
            </div>

            <h1 className="max-w-xl text-5xl font-black leading-tight tracking-tight xl:text-6xl">
              Teste grátis do sistema por{" "}
              <span className="text-[#f6c24a]">7 dias</span>
            </h1>

            <div className="mt-6 h-1.5 w-16 rounded-full bg-[#f6c24a]" />

            <p className="mt-8 max-w-xl text-xl leading-9 text-slate-300">
              Cadastre sua empresa, crie sua senha e comece agora mesmo a gerenciar seu negócio com o Oliver ERP.
            </p>

            <div className="mt-10 space-y-5">
              <div className="flex items-center gap-5 rounded-3xl border border-[#f6c24a]/25 bg-black/35 p-5 shadow-2xl backdrop-blur">
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-[#f6c24a]/25 bg-[#f6c24a]/10 shadow-[0_0_30px_rgba(246,194,74,0.12)]">
                  <Zap className="h-10 w-10 text-[#f6c24a]" />
                </div>
                <div>
                  <p className="text-xl font-black text-[#f6c24a]">Liberação automática</p>
                  <p className="mt-1 text-base leading-7 text-slate-300">
                    O acesso de teste é criado na hora.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 rounded-3xl border border-[#f6c24a]/25 bg-black/35 p-5 shadow-2xl backdrop-blur">
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-[#f6c24a]/25 bg-[#f6c24a]/10 shadow-[0_0_30px_rgba(246,194,74,0.12)]">
                  <Building2 className="h-10 w-10 text-[#f6c24a]" />
                </div>
                <div>
                  <p className="text-xl font-black text-[#f6c24a]">Acesso por empresa</p>
                  <p className="mt-1 text-base leading-7 text-slate-300">
                    Cada empresa recebe um link próprio de acesso.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 text-sm font-semibold text-slate-300">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#f6c24a]" />
            <p>Seus dados ficam organizados e protegidos no ambiente da sua empresa.</p>
          </div>
        </section>

        <section className="relative z-10 flex items-center justify-center p-5 lg:p-10">
          <form
            onSubmit={enviar}
            className="w-full max-w-4xl rounded-[2rem] border border-white/10 bg-[#101722]/92 p-6 text-white shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8"
          >
            <div className="mb-7">
              <div className="mb-5 flex justify-center lg:hidden">
                <img
                  src="/oliver-erp-login.png"
                  alt="OLIVER ERP"
                  className="max-h-32 w-auto object-contain drop-shadow-2xl"
                />
              </div>

              <h2 className="text-4xl font-black tracking-tight">Cadastre sua empresa</h2>
              <p className="mt-3 text-lg text-slate-300">
                Preencha os dados abaixo para começar seu teste grátis.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label className="mb-2 block font-bold text-white">Nome da empresa</Label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={form.empresaNome}
                    onChange={(e) => atualizar("empresaNome", e.target.value)}
                    placeholder="Ex.: Oliver Barbearia"
                    className="h-14 rounded-xl border-white/10 bg-[#0b111a] pl-12 text-white placeholder:text-slate-500"
                  />
                </div>
                {slugPreview && (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Link previsto: /{slugPreview}/login
                  </p>
                )}
              </div>

              <div>
                <Label className="mb-2 block font-bold text-white">Sistema desejado</Label>
                <select
                  value={form.sistemaTipo}
                  onChange={(e) => atualizar("sistemaTipo", e.target.value)}
                  className="h-14 w-full rounded-xl border border-white/10 bg-[#0b111a] px-4 text-white focus:border-[#f6c24a] focus:outline-none"
                >
                  <option value="beauty">Oliver Beauty</option>
                  <option value="fit">Oliver Fit</option>
                  <option value="clinic">Oliver Clinic</option>
                </select>
              </div>

              <div>
                <Label className="mb-2 block font-bold text-white">Segmento</Label>
                <Input
                  value={form.segmento}
                  onChange={(e) => atualizar("segmento", e.target.value)}
                  placeholder="Barbearia, salão, academia, clínica..."
                  className="h-14 rounded-xl border-white/10 bg-[#0b111a] text-white placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label className="mb-2 block font-bold text-white">WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={form.telefone}
                    onChange={(e) => atualizar("telefone", e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="h-14 rounded-xl border-white/10 bg-[#0b111a] pl-12 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block font-bold text-white">E-mail comercial</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={form.email}
                    onChange={(e) => atualizar("email", e.target.value)}
                    placeholder="empresa@email.com"
                    className="h-14 rounded-xl border-white/10 bg-[#0b111a] pl-12 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block font-bold text-white">Cidade</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={form.cidade}
                    onChange={(e) => atualizar("cidade", e.target.value)}
                    placeholder="Cidade"
                    className="h-14 rounded-xl border-white/10 bg-[#0b111a] pl-12 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block font-bold text-white">UF</Label>
                <Input
                  value={form.uf}
                  onChange={(e) => atualizar("uf", e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="TO"
                  className="h-14 rounded-xl border-white/10 bg-[#0b111a] text-white placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label className="mb-2 block font-bold text-white">CNPJ/CPF</Label>
                <Input
                  value={form.documento}
                  onChange={(e) => atualizar("documento", e.target.value)}
                  placeholder="Opcional"
                  className="h-14 rounded-xl border-white/10 bg-[#0b111a] text-white placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label className="mb-2 block font-bold text-white">Nome do responsável</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={form.responsavelNome}
                    onChange={(e) => atualizar("responsavelNome", e.target.value)}
                    placeholder="Nome completo"
                    className="h-14 rounded-xl border-white/10 bg-[#0b111a] pl-12 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block font-bold text-white">E-mail de acesso</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={form.responsavelEmail}
                    onChange={(e) => atualizar("responsavelEmail", e.target.value)}
                    placeholder="admin@empresa.com"
                    className="h-14 rounded-xl border-white/10 bg-[#0b111a] pl-12 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block font-bold text-white">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    type={mostrarSenha ? "text" : "password"}
                    value={form.senha}
                    onChange={(e) => atualizar("senha", e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="h-14 rounded-xl border-white/10 bg-[#0b111a] px-12 text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="mb-2 block font-bold text-white">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    type={mostrarSenha ? "text" : "password"}
                    value={form.confirmarSenha}
                    onChange={(e) => atualizar("confirmarSenha", e.target.value)}
                    placeholder="Repita a senha"
                    className="h-14 rounded-xl border-white/10 bg-[#0b111a] px-12 text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-[#f6c24a]/45 bg-[#f6c24a]/5 p-5">
              <div className="flex gap-4">
                <ShieldCheck className="mt-1 h-7 w-7 shrink-0 text-[#f6c24a]" />
                <div>
                  <p className="font-black text-[#f6c24a]">Período de teste grátis</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Você terá 7 dias de acesso completo ao sistema.
                    Após este período, o acesso só será renovado mediante confirmação de pagamento.
                  </p>
                </div>
              </div>
            </div>

            <label className="mt-5 flex items-start gap-3 text-sm font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={form.aceitarTermos}
                onChange={(e) => atualizar("aceitarTermos", e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-[#0b111a]"
              />
              <span>
                Estou ciente e aceito o período de 7 dias de teste grátis.
              </span>
            </label>

            <Button
              type="submit"
              disabled={carregando}
              className="mt-6 h-14 w-full rounded-xl bg-gradient-to-r from-[#d99b19] via-[#f5c84b] to-[#f7d56b] text-lg font-black text-black shadow-[0_18px_45px_rgba(246,194,74,0.22)] hover:brightness-105"
            >
              {carregando ? "Criando teste..." : "Criar meu teste grátis"}
              <ArrowRight className="ml-3 h-6 w-6" />
            </Button>

            <div className="mt-5 flex justify-center gap-2 text-xs font-semibold text-slate-500">
              <Lock className="h-4 w-4" />
              Não cobramos nada agora. Seu teste é gratuito por 7 dias.
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
