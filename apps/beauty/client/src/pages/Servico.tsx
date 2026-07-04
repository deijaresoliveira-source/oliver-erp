import { useBarbearia } from '@/contexts/BarbeariaContext';
import { Plus, Edit2, Trash2, Scissors, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMemo, useState } from 'react';

export default function Servico() {
  const { servicos, adicionarServico, atualizarServico, deletarServico } = useBarbearia();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [formData, setFormData] = useState({ nome: '', valor: 0, duracao: '', categoria: '', comissao: 40, agendamentoOnline: true });

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));

  const servicosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return servicos;

    return servicos.filter((s) =>
      [s.nome, s.duracao, s.categoria, String(s.valor), String(s.comissao)]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    );
  }, [servicos, busca]);

  const abrir = (id?: string) => {
    const s = id ? servicos.find((x) => x.id === id) : undefined;

    if (s) {
      setFormData({
        nome: s.nome,
        valor: Number(s.valor || 0),
        duracao: s.duracao,
        categoria: s.categoria || '',
        comissao: Number(s.comissao || 40),
        agendamentoOnline: s.agendamentoOnline !== false,
      });
      setEditando(id || null);
    } else {
      setFormData({ nome: '', valor: 0, duracao: '', categoria: '', comissao: 40, agendamentoOnline: true });
      setEditando(null);
    }

    setModalAberto(true);
  };

  const salvar = () => {
    if (!formData.nome || !formData.valor || !formData.duracao) {
      alert('Preencha nome, valor e duração.');
      return;
    }

    editando ? atualizarServico(editando, formData) : adicionarServico(formData);
    setModalAberto(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Serviços</h1>
              <p className="text-muted-foreground">Serviços, duração, valores e comissão.</p>
            </div>

            <Button onClick={() => abrir()} className="btn-premium gap-2">
              <Plus className="h-4 w-4" />
              Novo Serviço
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar serviço, categoria, duração ou comissão..."
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {servicos.length === 0 ? (
          <div className="card-premium py-16 text-center">
            <Scissors className="mx-auto mb-4 h-16 w-16 text-primary opacity-50" />
            <p className="mb-6 text-lg text-muted-foreground">Nenhum serviço cadastrado</p>
            <Button onClick={() => abrir()} className="btn-premium">
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Serviço
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b bg-secondary/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">Serviço</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Duração</th>
                  <th className="p-3 text-right">Comissão</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-center">Online</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {servicosFiltrados.map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0 hover:bg-secondary/40">
                    <td className="p-3 font-bold text-foreground">{s.nome}</td>
                    <td className="p-3 text-muted-foreground">{s.categoria || 'Sem categoria'}</td>
                    <td className="p-3 text-muted-foreground">{s.duracao}</td>
                    <td className="p-3 text-right font-semibold">{Number(s.comissao || 0)}%</td>
                    <td className="p-3 text-right text-base font-black text-primary">{formatarMoeda(s.valor)}</td>
                    <td className="p-3 text-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.agendamentoOnline === false ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                        {s.agendamentoOnline === false ? 'Não' : 'Sim'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => abrir(s.id)} title="Editar">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-destructive"
                          onClick={() => confirm('Excluir serviço?') && deletarServico(s.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!servicosFiltrados.length && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Nenhum serviço encontrado para a pesquisa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome do Serviço *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Corte Masculino"
                className="mt-1 border-border bg-secondary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <Input
                  type="number"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
                  className="mt-1 border-border bg-secondary"
                  step="0.01"
                />
              </div>
              <div>
                <Label>Duração *</Label>
                <Input
                  value={formData.duracao}
                  onChange={(e) => setFormData({ ...formData, duracao: e.target.value })}
                  placeholder="Ex: 30 min"
                  className="mt-1 border-border bg-secondary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Input
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Cabelo, barba..."
                  className="mt-1 border-border bg-secondary"
                />
              </div>
              <div>
                <Label>Comissão %</Label>
                <Input
                  type="number"
                  value={formData.comissao}
                  onChange={(e) => setFormData({ ...formData, comissao: Number(e.target.value) })}
                  className="mt-1 border-border bg-secondary"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-secondary/50 p-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={formData.agendamentoOnline}
                onChange={(e) => setFormData({ ...formData, agendamentoOnline: e.target.checked })}
                className="h-4 w-4"
              />
              <span>
                <b>Disponível no agendamento online</b>
                <br />
                <span className="text-xs text-muted-foreground">Quando desmarcado, o cliente não verá este serviço na página pública.</span>
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={salvar} className="btn-premium">
                Salvar Serviço
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
