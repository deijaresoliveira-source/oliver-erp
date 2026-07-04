import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBarbearia } from '@/contexts/BarbeariaContext';
import { Trash2, Plus, Edit2, Phone, Mail, Calendar, TrendingUp } from 'lucide-react';
import { useState } from 'react';

function formatarData(data: any) {
  if (!data) return "";

  try {
    const d = new Date(data);

    if (isNaN(d.getTime())) {
      return String(data);
    }

    return d.toLocaleDateString("pt-BR");
  } catch {
    return String(data);
  }
}
export default function Clientes() {
  const { clientes, agendamentos, adicionarCliente, atualizarCliente, deletarCliente } = useBarbearia();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    observacao: '',
  });

  const handleAbrirModal = (clienteId?: string) => {
    if (clienteId) {
      const cliente = clientes.find(c => c.id === clienteId);
      if (cliente) {
        setFormData({
          nome: cliente.nome,
          telefone: cliente.telefone,
          email: cliente.email || '',
          observacao: cliente.observacao || '',
        });
        setEditando(clienteId);
      }
    } else {
      setFormData({ nome: '', telefone: '', email: '', observacao: '' });
      setEditando(null);
    }
    setModalAberto(true);
  };

  const handleSalvar = () => {
    if (!formData.nome.trim() || !formData.telefone.trim()) {
      alert('Nome e telefone são obrigatórios');
      return;
    }

    if (editando) {
      atualizarCliente(editando, formData);
    } else {
      adicionarCliente(formData);
    }

    setModalAberto(false);
    setFormData({ nome: '', telefone: '', email: '', observacao: '' });
  };

  const getIniciais = (nome: string) => {
    return nome
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Inteligência: Contar agendamentos por cliente
  const getAgendamentosCliente = (clienteId: string) => {
    return agendamentos.filter(a => a.clienteId === clienteId && a.status !== 'Cancelado').length;
  };

  // Inteligência: Calcular receita por cliente
  const getReceitaCliente = (clienteId: string) => {
    return agendamentos
      .filter(a => a.clienteId === clienteId && a.status !== 'Cancelado')
      .reduce((sum, a) => sum + a.valor, 0);
  };

  const clientesOrdenados = [...clientes].sort((a, b) => {
    const receitaA = getReceitaCliente(a.id);
    const receitaB = getReceitaCliente(b.id);
    return receitaB - receitaA;
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header Premium */}
      <div className="sticky top-0 z-10 glass border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground">Gerenciar base de clientes</p>
          </div>
          <Button
            onClick={() => handleAbrirModal()}
            className="btn-premium gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {clientes.length === 0 ? (
          <div className="text-center py-16 card-premium">
            <p className="text-muted-foreground mb-6 text-lg">Nenhum cliente cadastrado</p>
            <Button
              onClick={() => handleAbrirModal()}
              className="btn-premium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeiro Cliente
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {clientesOrdenados.map((cliente, index) => {
              const agendamentosCount = getAgendamentosCliente(cliente.id);
              const receita = getReceitaCliente(cliente.id);
              const isVIP = agendamentosCount >= 3;

              return (
                <div
                  key={cliente.id}
                  className={`card-premium animate-fade-in ${isVIP ? 'border-gold' : ''}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar Premium */}
                    <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-lg ${isVIP ? 'bg-gradient-to-br from-primary to-accent text-background' : 'bg-secondary text-foreground'}`}>
                      {getIniciais(cliente.nome)}
                    </div>

                    {/* Informações */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">{cliente.nome}</h3>
                        {isVIP && <span className="badge-premium">⭐ VIP</span>}
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <a href={`tel:${cliente.telefone}`} className="hover:text-primary transition">
                            {cliente.telefone}
                          </a>
                        </div>
                        {cliente.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <a href={`mailto:${cliente.email}`} className="hover:text-primary transition">
                              {cliente.email}
                            </a>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Cadastrado em {formatarData(cliente.dataCadastro)}</span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-primary" />
                          <span className="text-foreground font-semibold">{agendamentosCount} agendamentos</span>
                        </div>
                        <div className="text-primary font-semibold">
                          R$ {receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      {cliente.observacao && (
                        <p className="text-xs text-muted-foreground italic mt-2">"{cliente.observacao}"</p>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAbrirModal(cliente.id)}
                        className="border-border hover:bg-secondary"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Deseja deletar ${cliente.nome}?`)) {
                            deletarCliente(cliente.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editando ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nome" className="text-foreground">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome completo"
                className="bg-secondary border-border text-foreground"
              />
            </div>

            <div>
              <Label htmlFor="telefone" className="text-foreground">Telefone *</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(63) 99999-9999"
                type="tel"
                className="bg-secondary border-border text-foreground"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                type="email"
                className="bg-secondary border-border text-foreground"
              />
            </div>

            <div>
              <Label htmlFor="observacao" className="text-foreground">Observação</Label>
              <Textarea
                id="observacao"
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                placeholder="Notas sobre o cliente..."
                rows={3}
                className="bg-secondary border-border text-foreground"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setModalAberto(false)}
                className="border-border text-foreground hover:bg-secondary"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSalvar}
                className="btn-premium"
              >
                {editando ? 'Atualizar' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
