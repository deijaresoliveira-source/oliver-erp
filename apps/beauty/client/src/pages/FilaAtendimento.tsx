import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useBarbearia } from '@/contexts/BarbeariaContext';
import { Plus, Phone, Play, Trash2, UserCheck, CheckCircle2, Clock, RefreshCw, MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const corStatus: Record<string, string> = {
  Aguardando: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/30',
  Chamado: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  'Em atendimento': 'text-orange-300 bg-orange-500/15 border-orange-500/30',
  Finalizado: 'text-zinc-300 bg-zinc-500/15 border-zinc-500/30',
};

async function api(path: string, options: RequestInit = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Erro na API');
  return j?.data;
}

function telefoneParaWhatsApp(telefone: string) {
  const numero = String(telefone || '').replace(/\D/g, '');
  if (!numero) return '';
  return numero.startsWith('55') ? numero : `55${numero}`;
}

function abrirWhatsapp(telefone: string, mensagem: string) {
  const numero = telefoneParaWhatsApp(telefone);
  if (!numero) return alert('Cliente sem telefone cadastrado.');
  const texto = encodeURIComponent(mensagem);
  window.location.href = `whatsapp://send?phone=${numero}&text=${texto}`;
  setTimeout(() => window.open(`https://wa.me/${numero}?text=${texto}`, '_blank'), 900);
}

export default function FilaAtendimento() {
  const contexto = useBarbearia() as any;
  const { clientes, servicos, profissionais, filaAtendimento } = contexto;
  const [fila, setFila] = useState<any[]>(filaAtendimento || []);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [formData, setFormData] = useState({ clienteId: '', servicoId: '', profissionalId: '', observacao: '' });

  const carregarFila = async () => {
    try {
      setCarregando(true);
      try {
        const dados = await api('/api/fila');
        setFila(dados || []);
      } catch {
        const boot = await api('/api/bootstrap');
        setFila(boot?.filaAtendimento || []);
      }
    } catch (e: any) {
      alert('Erro ao carregar fila: ' + (e?.message || String(e)));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarFila();
    const aoFocar = () => carregarFila();
    window.addEventListener('focus', aoFocar);
    return () => window.removeEventListener('focus', aoFocar);
  }, []);

  const ativos = useMemo(() => (fila || []).filter((f) => f.status !== 'Finalizado'), [fila]);
  const finalizados = useMemo(() => (fila || []).filter((f) => f.status === 'Finalizado'), [fila]);

  const salvar = async () => {
    try {
      const c = clientes.find((x: any) => String(x.id) === String(formData.clienteId));
      if (!c) return alert('Selecione o cliente.');

      const s = servicos.find((x: any) => String(x.id) === String(formData.servicoId));
      const p = profissionais.find((x: any) => String(x.id) === String(formData.profissionalId));

      await api('/api/fila', {
        method: 'POST',
        body: JSON.stringify({
          clienteId: c.id,
          servicoId: s?.id || null,
          profissionalId: p?.id || null,
          observacao: formData.observacao || null,
        }),
      });

      setModalAberto(false);
      setFormData({ clienteId: '', servicoId: '', profissionalId: '', observacao: '' });
      await carregarFila();
    } catch (e: any) {
      alert('Erro ao adicionar na fila: ' + (e?.message || String(e)));
    }
  };

  const alterarStatus = async (id: string, status: string) => {
    try {
      await api(`/api/fila/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      await carregarFila();
    } catch (e: any) {
      alert('Erro ao atualizar fila: ' + (e?.message || String(e)));
    }
  };

  const remover = async (id: string) => {
    try {
      if (!confirm('Remover cliente da fila?')) return;
      await api(`/api/fila/${id}`, { method: 'DELETE' });
      await carregarFila();
    } catch (e: any) {
      alert('Erro ao remover da fila: ' + (e?.message || String(e)));
    }
  };

  const chamar = async (f: any) => {
    await alterarStatus(f.id, 'Chamado');
    if (f.telefone) {
      abrirWhatsapp(
        f.telefone,
        [`Olá, ${f.clienteNome}!`, '', 'Sua vez chegou.', 'Por favor, dirija-se ao atendimento.', '', 'Obrigado!'].join('\n'),
      );
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 glass border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Fila de Atendimento</h1>
            <p className="text-muted-foreground">Chegada, chamada, início e finalização do atendimento.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={carregarFila} className="gap-2" disabled={carregando}>
              <RefreshCw className="w-4 h-4" /> Atualizar
            </Button>
            <Button onClick={() => setModalAberto(true)} className="btn-premium gap-2">
              <Plus className="w-4 h-4" /> Adicionar na fila
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="card-premium">
          <h2 className="text-xl font-semibold mb-4">Fila atual</h2>
          {ativos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum cliente aguardando.</div>
          ) : (
            <div className="space-y-3">
              {ativos.map((f, i) => (
                <div key={f.id} className="rounded-xl border border-border bg-secondary/50 p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">{i + 1}</div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{f.clienteNome}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full border ${corStatus[f.status] || corStatus.Aguardando}`}>{f.status}</span>
                        </div>
                        <p className="text-sm text-muted-foreground"><Clock className="w-4 h-4 inline mr-1" />Chegou {f.chegada || '--:--'} • {f.servicoNome || 'Serviço não definido'} • {f.profissionalNome || 'Qualquer profissional'}</p>
                        {f.telefone && <p className="text-sm text-muted-foreground"><Phone className="w-4 h-4 inline mr-1" />{f.telefone}</p>}
                        {f.observacao && <p className="text-xs text-muted-foreground italic mt-1 whitespace-pre-line">{f.observacao}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => chamar(f)}><UserCheck className="w-4 h-4 mr-1" />Chamar</Button>
                      <Button size="sm" variant="outline" onClick={() => alterarStatus(f.id, 'Em atendimento')}><Play className="w-4 h-4 mr-1" />Iniciar</Button>
                      {f.telefone && <Button size="sm" variant="outline" className="text-primary" onClick={() => abrirWhatsapp(f.telefone, `Olá, ${f.clienteNome}! Estamos aguardando você para o atendimento.`)}><MessageCircle className="w-4 h-4 mr-1" />WhatsApp</Button>}
                      <Button size="sm" variant="outline" onClick={() => alterarStatus(f.id, 'Finalizado')}><CheckCircle2 className="w-4 h-4 mr-1" />Finalizar</Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => remover(f.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="card-premium"><p className="text-muted-foreground text-sm">Aguardando</p><p className="text-3xl font-bold text-yellow-400">{ativos.filter((f) => f.status === 'Aguardando').length}</p></div>
          <div className="card-premium"><p className="text-muted-foreground text-sm">Chamados</p><p className="text-3xl font-bold text-blue-400">{ativos.filter((f) => f.status === 'Chamado').length}</p></div>
          <div className="card-premium"><p className="text-muted-foreground text-sm">Em atendimento</p><p className="text-3xl font-bold text-orange-400">{ativos.filter((f) => f.status === 'Em atendimento').length}</p></div>
          <div className="card-premium"><p className="text-muted-foreground text-sm">Finalizados</p><p className="text-3xl font-bold">{finalizados.length}</p></div>
        </div>
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Adicionar cliente na fila</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={formData.clienteId} onValueChange={(v) => setFormData({ ...formData, clienteId: v })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clientes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Serviço</Label>
              <Select value={formData.servicoId} onValueChange={(v) => setFormData({ ...formData, servicoId: v })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>{servicos.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Profissional desejado</Label>
              <Select value={formData.profissionalId} onValueChange={(v) => setFormData({ ...formData, profissionalId: v })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>{profissionais.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={formData.observacao} onChange={(e) => setFormData({ ...formData, observacao: e.target.value })} className="bg-secondary border-border" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button className="btn-premium" onClick={salvar}>Adicionar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
