import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageShell } from '@/components/PageShell';
import { CheckCircle2, Clock, Edit2, Plus, Search, Trash2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Usuario = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  status?: string;
  permissoes: string[];
};

type UsuarioPendente = {
  id: string;
  nome: string;
  email: string;
  senha?: string;
  telefone?: string;
  perfil?: string;
  status?: string;
  criadoEm?: string;
  permissoes?: string[];
};

const permissoesDisponiveis = [
  ['inicio.ver', 'Início - Ver'],
  ['agenda.ver', 'Agenda - Ver'],
  ['agenda.ver_apenas_minha', 'Agenda - Ver somente minha agenda'],
  ['agenda.criar', 'Agenda - Criar'],
  ['agenda.editar', 'Agenda - Editar'],
  ['agenda.finalizar', 'Agenda - Finalizar'],
  ['clientes.ver', 'Clientes - Ver'],
  ['clientes.criar', 'Clientes - Criar'],
  ['clientes.editar', 'Clientes - Editar'],
  ['profissionais.ver', 'Profissionais - Ver'],
  ['servicos.ver', 'Serviços - Ver'],
  ['produtos.ver', 'Produtos - Ver'],
  ['produtos.editar', 'Produtos - Editar'],
  ['financeiro.ver', 'Financeiro - Ver'],
  ['financeiro.proprio.ver', 'Financeiro - Ver somente meu financeiro'],
  ['financeiro.proprio.comissoes', 'Financeiro - Ver minhas comissões'],
  ['financeiro.proprio.atendimentos', 'Financeiro - Ver meus atendimentos'],
  ['clientes.proprio.ver', 'Clientes - Ver somente meus clientes'],
  ['fluxo.ver', 'Fluxo de Caixa - Ver'],
  ['despesas.ver', 'Despesas - Ver'],
  ['despesas.pagar', 'Despesas - Pagar'],
  ['pacotes.ver', 'Pacotes - Ver'],
  ['fila.ver', 'Fila de Espera - Ver'],
  ['relatorios.ver', 'Relatórios - Ver'],
  ['configuracoes.ver', 'Configurações - Ver'],
  ['usuarios.gerenciar', 'Usuários - Gerenciar'],
];

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false) throw new Error(json?.error || 'Erro na API');
  return json?.data;
}

export default function UsuariosPermissoes() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pendentes, setPendentes] = useState<UsuarioPendente[]>([]);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [pendenteSelecionado, setPendenteSelecionado] = useState<UsuarioPendente | null>(null);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [buscaPendente, setBuscaPendente] = useState('');
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    perfil: 'Profissional',
    permissoes: [] as string[],
  });

  const carregar = async () => {
    const dados = await api('/api/usuarios');
    setUsuarios(dados || []);

    const dadosPendentes = await api('/api/usuarios-pendentes');
    setPendentes(dadosPendentes || []);
  };

  useEffect(() => {
    carregar().catch((e) => alert(e.message));
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const termo = buscaUsuario.trim().toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter((u) =>
      [u.nome, u.email, u.perfil, u.status, String(u.permissoes?.length || 0)]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    );
  }, [usuarios, buscaUsuario]);

  const pendentesFiltrados = useMemo(() => {
    const termo = buscaPendente.trim().toLowerCase();
    if (!termo) return pendentes;
    return pendentes.filter((u) =>
      [u.nome, u.email, u.telefone, u.perfil, u.status]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    );
  }, [pendentes, buscaPendente]);

  const abrir = (u?: Usuario) => {
    if (u) {
      setEditando(u);
      setPendenteSelecionado(null);
      setForm({
        nome: u.nome,
        email: u.email,
        senha: '',
        perfil: u.perfil || 'Profissional',
        permissoes: u.permissoes || [],
      });
    } else {
      setEditando(null);
      setPendenteSelecionado(null);
      setForm({ nome: '', email: '', senha: '', perfil: 'Profissional', permissoes: [] });
    }
    setModal(true);
  };

  const togglePermissao = (codigo: string) => {
    setForm((atual) => ({
      ...atual,
      permissoes: atual.permissoes.includes(codigo)
        ? atual.permissoes.filter((p) => p !== codigo)
        : [...atual.permissoes, codigo],
    }));
  };

  const salvar = async () => {
    if (!form.nome || !form.email) return alert('Informe nome e email.');

    if (pendenteSelecionado) {
      await api(`/api/usuarios/${pendenteSelecionado.id}/aprovar`, {
        method: 'PUT',
        body: JSON.stringify({
          perfil: form.perfil || 'Profissional',
          permissoes: form.permissoes || [],
        }),
      });
      setPendenteSelecionado(null);
    } else if (editando) {
      await api(`/api/usuarios/${editando.id}`, { method: 'PUT', body: JSON.stringify(form) });
    } else {
      if (!form.senha) return alert('Informe uma senha para o novo usuário.');
      await api('/api/usuarios', { method: 'POST', body: JSON.stringify(form) });
    }

    setModal(false);
    await carregar();
  };

  const excluir = async (id: string) => {
    if (!confirm('Desativar usuário?')) return;
    await api(`/api/usuarios/${id}`, { method: 'DELETE' });
    await carregar();
  };

  const abrirPendente = (u: UsuarioPendente) => {
    setEditando(null);
    setPendenteSelecionado(u);
    setForm({
      nome: u.nome || '',
      email: u.email || '',
      senha: u.senha || '',
      perfil: u.perfil || 'Profissional',
      permissoes: u.permissoes || [],
    });
    setModal(true);
  };

  const removerPendente = async (id: string) => {
    if (!confirm('Recusar esta solicitação de acesso?')) return;
    await api(`/api/usuarios/${id}/rejeitar`, { method: 'PUT' });
    await carregar();
  };

  const autorizarPendente = async (u: UsuarioPendente) => {
    if (!confirm(`Autorizar acesso para ${u.nome}?`)) return;

    try {
      await api(`/api/usuarios/${u.id}/aprovar`, {
        method: 'PUT',
        body: JSON.stringify({
          perfil: u.perfil || 'Profissional',
          permissoes: u.permissoes || [],
        }),
      });

      await carregar();
      alert('Usuário autorizado com sucesso.');
    } catch (e: any) {
      alert('Erro ao autorizar usuário: ' + e.message);
    }
  };

  return (
    <PageShell
      title="Usuários e Permissões"
      subtitle="Controle quem acessa cada tela, autorize usuários pendentes e defina permissões."
      actions={
        <Button onClick={() => abrir()} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo usuário
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 shadow-sm dark:bg-amber-950/20">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-amber-900 dark:text-amber-200">
                <Clock className="h-5 w-5" />
                Usuários pendentes
              </h2>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Solicitações criadas na tela de login aguardam autorização do administrador.
              </p>
            </div>
            <span className="w-fit rounded-full bg-amber-200 px-3 py-1 text-sm font-black text-amber-900">
              {pendentes.length}
            </span>
          </div>

          <div className="mb-3 flex items-center gap-2 rounded-xl border bg-white px-3 dark:bg-background">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={buscaPendente}
              onChange={(e) => setBuscaPendente(e.target.value)}
              placeholder="Pesquisar pendente por nome, e-mail ou telefone..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>

          {!pendentes.length ? (
            <p className="rounded-xl border border-amber-200 bg-white/70 p-4 text-center text-sm text-amber-900 dark:bg-background/50 dark:text-amber-200">
              Nenhum usuário pendente no momento.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white dark:bg-background">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-secondary/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">E-mail</th>
                    <th className="p-3">Telefone</th>
                    <th className="p-3">Perfil</th>
                    <th className="p-3">Solicitado em</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pendentesFiltrados.map((u) => (
                    <tr key={u.id} className="border-t hover:bg-secondary/40">
                      <td className="p-3 font-bold">{u.nome}</td>
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{u.telefone || '-'}</td>
                      <td className="p-3">{u.perfil || 'Profissional'}</td>
                      <td className="p-3">{u.criadoEm ? new Date(u.criadoEm).toLocaleString('pt-BR') : '-'}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => abrirPendente(u)}>
                            Permissões
                          </Button>
                          <Button size="sm" className="gap-1" onClick={() => autorizarPendente(u)}>
                            <CheckCircle2 className="h-4 w-4" />
                            Autorizar
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => removerPendente(u.id)}>
                            <XCircle className="h-4 w-4" />
                            Recusar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!pendentesFiltrados.length && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        Nenhum pendente encontrado para a pesquisa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold">Usuários cadastrados</h2>
              <p className="text-sm text-muted-foreground">Lista em linhas para facilitar conferência e edição.</p>
            </div>
            <span className="w-fit rounded-full bg-primary/15 px-3 py-1 text-sm font-black text-primary">
              {usuarios.length}
            </span>
          </div>

          <div className="mb-3 flex items-center gap-2 rounded-xl border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={buscaUsuario}
              onChange={(e) => setBuscaUsuario(e.target.value)}
              placeholder="Pesquisar usuário, e-mail, perfil ou status..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-secondary/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">E-mail</th>
                  <th className="p-3">Perfil</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Permissões</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-secondary/40">
                    <td className="p-3 font-bold">{u.nome}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                        {u.perfil}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${u.ativo ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'}`}>
                        {u.ativo ? (u.status || 'ATIVO') : (u.status || 'INATIVO')}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {u.perfil === 'Administrador' ? 'Acesso total' : `${u.permissoes?.length || 0}`}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => abrir(u)}>
                          <Edit2 className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => excluir(u.id)}>
                          <Trash2 className="h-4 w-4" />
                          Desativar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!usuariosFiltrados.length && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Nenhum usuário encontrado para a pesquisa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-border bg-card">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar usuário' : pendenteSelecionado ? 'Autorizar usuário pendente' : 'Novo usuário'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Senha {editando ? '(deixe em branco para manter)' : ''}</Label>
              <Input
                type="password"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
              />
            </div>
            <div>
              <Label>Perfil base</Label>
              <select
                className="w-full rounded-xl border bg-background p-3"
                value={form.perfil}
                onChange={(e) => setForm({ ...form, perfil: e.target.value })}
              >
                <option>Administrador</option>
                <option>Gerente</option>
                <option>Caixa</option>
                <option>Profissional</option>
              </select>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-3 font-bold">Permissões individuais</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {permissoesDisponiveis.map(([codigo, nome]) => (
                <label key={codigo} className="flex items-center gap-3 rounded-xl border bg-background p-3">
                  <input
                    type="checkbox"
                    checked={form.permissoes.includes(codigo)}
                    onChange={() => togglePermissao(codigo)}
                    disabled={form.perfil === 'Administrador'}
                  />
                  <span>{nome}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar}>{pendenteSelecionado ? 'Autorizar acesso' : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
