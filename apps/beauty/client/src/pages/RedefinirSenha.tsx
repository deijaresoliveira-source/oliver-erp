import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function slugDaRotaAtual() {
  if (typeof window === "undefined") return "";
  const seg = String(window.location.pathname || "").split("/").filter(Boolean)[0] || "";
  const reservados = new Set(["login", "agendar", "admin", "admin-master", "api", "assets", "uploads", "cadastrar-empresa", "empresa-nao-informada"]);
  return seg && !reservados.has(seg) ? seg : "";
}

function tokenDaUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") || "";
}

export default function RedefinirSenha() {
  const [, navigate] = useLocation();
  const slugEmpresa = slugDaRotaAtual();
  const token = useMemo(() => tokenDaUrl(), []);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();

    if (!slugEmpresa) return toast.error("Empresa não informada.");
    if (!token) return toast.error("Token inválido ou ausente.");
    if (!senha) return toast.error("Informe a nova senha.");
    if (senha.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    if (senha !== confirmarSenha) return toast.error("As senhas não conferem.");

    try {
      setCarregando(true);

      const resposta = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-empresa-slug": slugEmpresa,
        },
        body: JSON.stringify({
          token,
          senha,
          confirmarSenha,
          empresaSlug: slugEmpresa,
        }),
      });

      const json = await resposta.json().catch(() => null);

      if (!resposta.ok || json?.ok === false) {
        throw new Error(json?.error || "Erro ao redefinir senha.");
      }

      setSucesso(true);
      toast.success("Senha redefinida com sucesso.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao redefinir senha.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-[#080808] text-white lg:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-[#101010]/78 to-black/92" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(212,175,55,0.28),transparent_34%),radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.10),transparent_28%)]" />

          <div className="relative z-10 flex w-full flex-col justify-center p-10 xl:p-14">
            <div className="max-w-2xl rounded-[2rem] border border-white/10 bg-black/35 p-6 shadow-2xl backdrop-blur-md xl:p-8">
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

              <p className="mt-6 text-lg leading-8 text-slate-300">
                Crie uma nova senha segura para voltar a acessar o sistema.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-gradient-to-br from-[#f7f7f7] via-white to-[#eaeaea] p-5">
          <div className="w-full max-w-xl rounded-[2rem] border border-[#d4af37]/25 bg-white p-8 shadow-2xl shadow-slate-300/60 sm:p-10">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-amber-200 bg-amber-50">
                {sucesso ? <CheckCircle2 className="h-8 w-8 text-emerald-600" /> : <Lock className="h-8 w-8 text-[#b8860b]" />}
              </div>

              <h1 className="text-4xl font-black text-slate-900">
                {sucesso ? "Senha alterada" : "Criar nova senha"}
              </h1>

              <p className="mt-4 text-lg text-slate-600">
                {sucesso ? "Sua senha foi atualizada com sucesso." : "Digite e confirme sua nova senha."}
              </p>

              <div className="mx-auto mt-5 h-1 w-24 rounded-full bg-gradient-to-r from-[#b8860b] via-[#d4af37] to-[#f7d56b]" />
            </div>

            {!sucesso ? (
              <form onSubmit={enviar} className="space-y-5">
                <div>
                  <Label className="mb-2 block text-base font-bold text-slate-900">Nova senha</Label>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

                    <Input
                      type={mostrarSenha ? "text" : "password"}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="h-14 rounded-xl bg-white px-12 text-base text-black placeholder:text-slate-400"
                      autoComplete="new-password"
                    />

                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                    >
                      {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block text-base font-bold text-slate-900">Confirmar senha</Label>

                  <Input
                    type={mostrarSenha ? "text" : "password"}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="h-14 rounded-xl bg-white text-base text-black placeholder:text-slate-400"
                    autoComplete="new-password"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={carregando}
                  className="h-14 w-full rounded-xl bg-gradient-to-r from-[#b8860b] via-[#d4af37] to-[#f7d56b] text-lg font-black text-black shadow-lg hover:brightness-105"
                >
                  {carregando ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </form>
            ) : (
              <Button
                type="button"
                onClick={() => navigate(slugEmpresa ? `/${slugEmpresa}/login` : "/login")}
                className="h-14 w-full rounded-xl bg-gradient-to-r from-[#b8860b] via-[#d4af37] to-[#f7d56b] text-lg font-black text-black shadow-lg hover:brightness-105"
              >
                Ir para o login
              </Button>
            )}

            {!sucesso && (
              <button
                type="button"
                onClick={() => navigate(slugEmpresa ? `/${slugEmpresa}/login` : "/login")}
                className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-bold text-[#b8860b]"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o login
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
