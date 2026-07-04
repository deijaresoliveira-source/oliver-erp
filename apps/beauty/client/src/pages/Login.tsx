import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Eye,
  EyeOff,
  Lock,
  BarChart3,
  LogIn,
  Mail,
  Cloud,
  ShieldCheck,
  Users,
  UserPlus,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const EMPRESA_CONFIG_KEY = '@sistema_saas_empresa_config';

type LoginConfig = {
  nome?: string;
  marca?: string;
  logoDbo?: string;
  logoEmpresa?: string;
  fundoLogin?: string;
  avisoVencimento?: {
    tipo?: string;
    titulo?: string;
    mensagem?: string;
    bloqueado?: boolean;
    diasRestantes?: number | null;
  };
};

function carregarConfigLocal(): LoginConfig {
  try {
    return JSON.parse(localStorage.getItem(EMPRESA_CONFIG_KEY) || '{}');
  } catch {
    return {};
  }
}

function slugDoSubdominioAtual() {
  if (typeof window === "undefined") return "";
  const host = String(window.location.hostname || "").toLowerCase();
  if (!host || host === "localhost" || host.startsWith("127.")) return "";

  const partes = host.split(".").filter(Boolean);
  if (partes.length < 3) return "";

  const primeiro = partes[0];
  const reservados = new Set(["www", "app", "api", "master", "admin", "admin-master"]);
  return reservados.has(primeiro) ? "" : primeiro;
}

function dominioBaseAtual() {
  if (typeof window === "undefined") return "";
  const host = String(window.location.hostname || "").toLowerCase();
  if (!host || host === "localhost" || host.startsWith("127.")) return host;

  const partes = host.split(".").filter(Boolean);
  if (partes.length >= 3) {
    return partes.slice(-2).join(".");
  }

  return host;
}

function urlEmpresaSubdominio(slug: string, path = "/login") {
  if (typeof window === "undefined" || !slug) return path;
  const base = dominioBaseAtual();
  if (!base || base === "localhost" || base.startsWith("127.")) {
    return `/${slug}${path}`;
  }

  return `${window.location.protocol}//${slug}.${base}${path}`;
}

function slugDaRotaLocal(location: string) {
  const seg = String(location || "").split("/").filter(Boolean)[0] || "";
  const reservados = new Set(["login", "agendar", "admin", "admin-master", "cadastrar-empresa", "empresa-nao-informada", "esqueci-senha", "redefinir-senha"]);
  return seg && !reservados.has(seg) ? seg : "";
}

function prefixarRota(path: string, slug: string) {
  if (!slug) return path;

  // Se já está em empresa.olivererp.com, as rotas internas não precisam do slug.
  if (slugDoSubdominioAtual()) return path;

  // Em produção, saindo de app.olivererp.com para uma empresa, usa subdomínio.
  const base = dominioBaseAtual();
  if (base && base !== "localhost" && !base.startsWith("127.")) {
    return urlEmpresaSubdominio(slug, path === "/" ? "/" : path);
  }

  // Compatibilidade para testes locais: localhost:3000/letsbarbearia/login
  if (path === "/") return `/${slug}/`;
  return `/${slug}${path}`;
}

export default function Login() {
  const [location, navigate] = useLocation();
  const slugEmpresa = slugDoSubdominioAtual() || slugDaRotaLocal(location);
  const { login } = useAuth();

  const [config, setConfig] = useState<LoginConfig>({
    logoDbo: '/oliver-erp-login.png',
    logoEmpresa: '',
    fundoLogin: '',
    marca: 'Sua Empresa',
  });

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLockAtivo, setCapsLockAtivo] = useState(false);
  const [erroLogin, setErroLogin] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [modoSolicitarAcesso, setModoSolicitarAcesso] = useState(false);
  const [solicitacao, setSolicitacao] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    telefone: '',
  });

  useEffect(() => {
    const local = carregarConfigLocal();

    fetch(`/api/empresa-por-slug/${slugEmpresa}`, { headers: { 'x-empresa-slug': slugEmpresa } })
      .then((r) => r.json())
      .then((j) => {
        const empresa = j?.data || {};
        setConfig({
          logoDbo: '/oliver-erp-login.png',
          logoEmpresa: empresa.logoEmpresa || '',
          fundoLogin: empresa.fundoLogin || '',
          nome: empresa.nome || '',
          marca: empresa.marca || empresa.nome || 'Sua Empresa',
          avisoVencimento: empresa.avisoVencimento,
        });
      })
      .catch(() => {
        setConfig({
          logoDbo: '/oliver-erp-login.png',
          logoEmpresa: local.logoEmpresa || '',
          fundoLogin: '',
          nome: local.nome || '',
          marca: local.marca || local.nome || 'Sua Empresa',
        });
      });
  }, [slugEmpresa]);


  const solicitarAcesso = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!solicitacao.nome.trim()) return toast.error('Informe seu nome.');
    if (!solicitacao.email.trim()) return toast.error('Informe seu e-mail.');
    if (!solicitacao.senha) return toast.error('Informe uma senha.');
    if (solicitacao.senha.length < 6) return toast.error('A senha deve ter pelo menos 6 caracteres.');
    if (solicitacao.senha !== solicitacao.confirmarSenha) return toast.error('As senhas não conferem.');

    const novoPendente = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      nome: solicitacao.nome.trim(),
      email: solicitacao.email.trim().toLowerCase(),
      senha: solicitacao.senha,
      telefone: solicitacao.telefone.trim(),
      perfil: 'Profissional',
      status: 'Pendente',
      criadoEm: new Date().toISOString(),
      permissoes: [],
    };

    try {
      setCarregando(true);

      const resposta = await fetch('/api/solicitar-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-empresa-slug': slugEmpresa },
        body: JSON.stringify({
          nome: novoPendente.nome,
          email: novoPendente.email,
          senha: novoPendente.senha,
          telefone: novoPendente.telefone,
          empresaSlug: slugEmpresa,
        }),
      });

      const json = await resposta.json().catch(() => null);
      if (!resposta.ok || json?.ok === false) {
        throw new Error(json?.error || 'Erro ao enviar solicitação de acesso.');
      }

      toast.success('Solicitação enviada. Aguarde o administrador autorizar seu acesso.');
      setSolicitacao({ nome: '', email: '', senha: '', confirmarSenha: '', telefone: '' });
      setModoSolicitarAcesso(false);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao solicitar acesso.');
    } finally {
      setCarregando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Digite o e-mail do usuário.");
      return;
    }

    if (!senha) {
      toast.error("Digite a senha.");
      return;
    }

    try {
      setCarregando(true);
      setErroLogin("");

      await login(email.trim(), senha, slugEmpresa);

      toast.success("Login realizado com sucesso.");
      navigate(prefixarRota("/", slugEmpresa));
    } catch (error: any) {
      const mensagem = error?.message || "E-mail ou senha inválidos.";
      setErroLogin(
        `${mensagem}${capsLockAtivo ? " Verifique também se o Caps Lock está ligado." : ""}`
      );
      toast.error(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-[#080808] text-white lg:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-[#101010]/78 to-black/92" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(212,175,55,0.28),transparent_34%),radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.10),transparent_28%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/90 to-transparent" />

          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
            <div>
              <div className="inline-flex rounded-full border border-[#d4af37]/35 bg-black/45 px-5 py-2 text-xs font-black uppercase tracking-[0.35em] text-[#f7d56b] shadow-2xl backdrop-blur">
                ERP SaaS Multiempresa
              </div>

              <div className="mt-7 max-w-2xl rounded-[2rem] border border-white/10 bg-black/35 p-6 shadow-2xl backdrop-blur-md xl:p-8">
                <div className="flex justify-center">
                  <img
                    src="/oliver-erp-login.png"
                    alt="OLIVER ERP"
                    className="max-h-40 w-auto object-contain drop-shadow-2xl xl:max-h-48"
                  />
                </div>

                <p className="mt-5 text-center text-2xl font-semibold text-slate-100">
                  Gestão Inteligente para Empresas
                </p>

                <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                  Controle clientes, agenda, financeiro, estoque, relatórios e indicadores em uma plataforma completa para organizar e fazer sua empresa crescer.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
                <div className="rounded-2xl border border-[#d4af37]/25 bg-black/40 p-4 text-center shadow-xl backdrop-blur">
                  <BarChart3 className="mx-auto h-8 w-8 text-[#f7d56b]" />
                  <p className="mt-3 text-sm font-black uppercase tracking-wide">Gestão Completa</p>
                </div>

                <div className="rounded-2xl border border-[#d4af37]/25 bg-black/40 p-4 text-center shadow-xl backdrop-blur">
                  <Users className="mx-auto h-8 w-8 text-[#f7d56b]" />
                  <p className="mt-3 text-sm font-black uppercase tracking-wide">Controle Total</p>
                </div>

                <div className="rounded-2xl border border-[#d4af37]/25 bg-black/40 p-4 text-center shadow-xl backdrop-blur">
                  <Cloud className="mx-auto h-8 w-8 text-[#f7d56b]" />
                  <p className="mt-3 text-sm font-black uppercase tracking-wide">Na Nuvem 24h</p>
                </div>

                <div className="rounded-2xl border border-[#d4af37]/25 bg-black/40 p-4 text-center shadow-xl backdrop-blur">
                  <ShieldCheck className="mx-auto h-8 w-8 text-[#f7d56b]" />
                  <p className="mt-3 text-sm font-black uppercase tracking-wide">Segurança</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#d4af37]/25 bg-black/45 p-5 shadow-2xl backdrop-blur">
              <p className="text-lg font-semibold text-slate-100">
                Um único sistema para integrar operação, financeiro e relatórios estratégicos do seu negócio.
              </p>
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center bg-gradient-to-br from-[#f7f7f7] via-white to-[#eaeaea] p-5">
          <div className="w-full max-w-xl rounded-[2rem] border border-[#d4af37]/25 bg-white p-8 shadow-2xl shadow-slate-300/60 sm:p-10">
            <div className="mb-10 text-center">
              <div className="mx-auto mb-6 flex min-h-28 w-full items-center justify-center rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-lg">
                {config.logoEmpresa ? (
                  <img
                    src={config.logoEmpresa}
                    alt={config.nome || config.marca || "Empresa"}
                    className="max-h-24 max-w-[280px] object-contain drop-shadow-2xl"
                  />
                ) : (
                  <span className="bg-gradient-to-b from-[#f7d56b] via-[#e7b83d] to-[#b97710] bg-clip-text text-5xl font-black text-transparent">
                    {config.marca || config.nome || 'Sua Empresa'}
                  </span>
                )}
              </div>

              <h1 className="text-4xl font-black text-slate-900 sm:text-5xl">
                {modoSolicitarAcesso ? 'Solicitar acesso' : 'Bem-vindo!'}
              </h1>

              <p className="mt-4 text-lg text-slate-600 sm:text-xl">
                {modoSolicitarAcesso
                  ? 'Preencha seus dados. O administrador precisa autorizar o acesso.'
                  : 'Acesse sua conta para continuar'}
              </p>

              <div className="mx-auto mt-5 h-1 w-24 rounded-full bg-gradient-to-r from-[#b8860b] via-[#d4af37] to-[#f7d56b]" />
            </div>

            {config.avisoVencimento?.tipo && config.avisoVencimento.tipo !== 'ok' && (
              <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${config.avisoVencimento.bloqueado ? 'border-red-200 bg-red-50 text-red-700' : config.avisoVencimento.tipo === 'critico' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                <p className="font-black">{config.avisoVencimento.titulo}</p>
                <p className="mt-1">{config.avisoVencimento.mensagem}</p>
              </div>
            )}

            {!modoSolicitarAcesso ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="mb-2 block text-base font-bold text-slate-900">
                  E-mail
                </Label>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Digite seu e-mail"
                    className="h-14 rounded-xl pl-12 text-base text-black placeholder:text-slate-400 bg-white"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block text-base font-bold text-slate-900">
                  Senha
                </Label>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

                  <Input
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    onKeyUp={(e) => setCapsLockAtivo(e.getModifierState("CapsLock"))}
                    placeholder="Digite sua senha"
                    className="h-14 rounded-xl px-12 text-base text-black placeholder:text-slate-400 bg-white"
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {capsLockAtivo && (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    Caps Lock está ligado
                  </p>
                )}
              </div>

              {erroLogin && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {erroLogin}
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600">
                  <input type="checkbox" />
                  Lembrar-me
                </label>

                <button
                  type="button"
                  className="font-medium text-[#b8860b]"
                  onClick={() => {
                    if (!slugEmpresa) {
                      toast.error("Empresa não informada.");
                      return;
                    }

                    navigate(prefixarRota("/esqueci-senha", slugEmpresa));
                  }}
                >
                  Esqueceu sua senha?
                </button>
              </div>

              <Button
                type="submit"
                disabled={carregando}
                className="h-14 w-full rounded-xl bg-gradient-to-r from-[#b8860b] via-[#d4af37] to-[#f7d56b] text-lg font-black text-black shadow-lg hover:brightness-105"
              >
                <LogIn className="mr-2 h-5 w-5" />
                {carregando ? "Entrando..." : "Entrar no Sistema"}
              </Button>
              <button
                type="button"
                onClick={() => setModoSolicitarAcesso(true)}
                className="w-full rounded-xl border border-[#d4af37]/30 bg-[#fff8df] px-4 py-3 text-sm font-bold text-[#8a5b00] hover:bg-[#fff0b8]"
              >
                <UserPlus className="mr-1 inline h-4 w-4" />
                Criar usuário / Solicitar acesso
              </button>
            </form>
            ) : (
            <form onSubmit={solicitarAcesso} className="space-y-5">
              <div>
                <Label className="mb-2 block text-base font-bold text-slate-900">Nome completo</Label>
                <Input value={solicitacao.nome} onChange={(e) => setSolicitacao({ ...solicitacao, nome: e.target.value })} placeholder="Digite seu nome" className="h-14 rounded-xl text-base text-black bg-white" />
              </div>

              <div>
                <Label className="mb-2 block text-base font-bold text-slate-900">E-mail</Label>
                <Input value={solicitacao.email} onChange={(e) => setSolicitacao({ ...solicitacao, email: e.target.value })} placeholder="Digite seu e-mail" className="h-14 rounded-xl text-base text-black bg-white" />
              </div>

              <div>
                <Label className="mb-2 block text-base font-bold text-slate-900">Telefone / WhatsApp</Label>
                <Input value={solicitacao.telefone} onChange={(e) => setSolicitacao({ ...solicitacao, telefone: e.target.value })} placeholder="Opcional" className="h-14 rounded-xl text-base text-black bg-white" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block text-base font-bold text-slate-900">Senha</Label>
                  <Input type="password" value={solicitacao.senha} onChange={(e) => setSolicitacao({ ...solicitacao, senha: e.target.value })} placeholder="Mínimo 6 caracteres" className="h-14 rounded-xl text-base text-black bg-white" />
                </div>
                <div>
                  <Label className="mb-2 block text-base font-bold text-slate-900">Confirmar senha</Label>
                  <Input type="password" value={solicitacao.confirmarSenha} onChange={(e) => setSolicitacao({ ...solicitacao, confirmarSenha: e.target.value })} placeholder="Repita a senha" className="h-14 rounded-xl text-base text-black bg-white" />
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                <Clock className="mr-1 inline h-4 w-4" />
                Após solicitar, o usuário ficará como pendente até o administrador autorizar.
              </div>

              <Button type="submit" disabled={carregando} className="h-14 w-full rounded-xl bg-gradient-to-r from-[#b8860b] via-[#d4af37] to-[#f7d56b] text-lg font-black text-black shadow-lg hover:brightness-105">
                <UserPlus className="mr-2 h-5 w-5" />
                {carregando ? 'Enviando...' : 'Solicitar acesso'}
              </Button>

              <button type="button" onClick={() => setModoSolicitarAcesso(false)} className="w-full text-sm font-bold text-[#b8860b]">
                Voltar para o login
              </button>
            </form>
            )}

           
            <div className="my-8 border-t border-slate-200" />

            <div className="text-center">
              <p className="text-sm font-bold text-slate-800">
                OLIVER ERP - Gestão Inteligente para Empresas
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Todos os direitos reservados © 2026
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
