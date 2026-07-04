import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

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

export default function EsqueciSenha() {
  const [, navigate] = useLocation();
  const slugEmpresa = slugDaRotaAtual();
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [previewLink, setPreviewLink] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();

    if (!slugEmpresa) return toast.error("Empresa não informada.");
    if (!email.trim()) return toast.error("Informe seu e-mail.");

    try {
      setCarregando(true);

      const resposta = await fetch("/api/auth/esqueci-senha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-empresa-slug": slugEmpresa,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          empresaSlug: slugEmpresa,
        }),
      });

      const json = await resposta.json().catch(() => null);

      if (!resposta.ok || json?.ok === false) {
        throw new Error(json?.error || "Erro ao solicitar redefinição de senha.");
      }

      setEnviado(true);
      setPreviewLink(json?.data?.previewLink || "");
      toast.success("Se o e-mail estiver cadastrado, enviaremos as instruções.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao solicitar redefinição de senha.");
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
                Informe seu e-mail cadastrado para receber um link seguro de redefinição de senha.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-gradient-to-br from-[#f7f7f7] via-white to-[#eaeaea] p-5">
          <div className="w-full max-w-xl rounded-[2rem] border border-[#d4af37]/25 bg-white p-8 shadow-2xl shadow-slate-300/60 sm:p-10">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-amber-200 bg-amber-50">
                <ShieldCheck className="h-8 w-8 text-[#b8860b]" />
              </div>

              <h1 className="text-4xl font-black text-slate-900">Esqueci minha senha</h1>

              <p className="mt-4 text-lg text-slate-600">
                {enviado ? "Verifique seu e-mail para continuar." : "Digite seu e-mail para receber o link de redefinição."}
              </p>

              <div className="mx-auto mt-5 h-1 w-24 rounded-full bg-gradient-to-r from-[#b8860b] via-[#d4af37] to-[#f7d56b]" />
            </div>

            {!enviado ? (
              <form onSubmit={enviar} className="space-y-5">
                <div>
                  <Label className="mb-2 block text-base font-bold text-slate-900">E-mail</Label>

                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Digite seu e-mail"
                      className="h-14 rounded-xl bg-white pl-12 text-base text-black placeholder:text-slate-400"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={carregando}
                  className="h-14 w-full rounded-xl bg-gradient-to-r from-[#b8860b] via-[#d4af37] to-[#f7d56b] text-lg font-black text-black shadow-lg hover:brightness-105"
                >
                  {carregando ? "Enviando..." : "Enviar link de redefinição"}
                </Button>
              </form>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-800">
                <p className="font-black">Solicitação registrada.</p>
                <p className="mt-2 text-sm font-semibold">
                  Se o e-mail estiver cadastrado nesta empresa, enviaremos um link válido por 30 minutos.
                </p>

                {previewLink && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
                    <p className="font-black">Modo desenvolvimento:</p>
                    <p className="mt-1 break-all">{previewLink}</p>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate(slugEmpresa ? `/${slugEmpresa}/login` : "/login")}
              className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-bold text-[#b8860b]"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para o login
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
