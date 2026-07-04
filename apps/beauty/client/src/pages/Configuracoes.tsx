import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Building2, Plus, Trash2, Save, Image, Eye, Upload, X, Lock, CalendarClock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageShell } from '@/components/PageShell';

type Forma = {
  id: string;
  nome: string;
  tipo: string;
  chavePix?: string;
  maquinaNome?: string;
  maquinaCodigo?: string;
  observacao?: string;
  taxaPercentual?: number;
  taxa?: number;
  ativo?: boolean;
};

type Empresa = {
  nome: string;
  marca: string;
  cnpj: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  observacao: string;
  logoDbo: string;
  logoEmpresa: string;
  logoMenu: string;
  fundoLogin: string;
  regraComissao: 'bruto' | 'liquido' | 'dividir_taxa';
  antecedenciaAgendamento: number;
};

const EMPRESA_CONFIG_KEY = '@sistema_saas_empresa_config';

const empresaPadrao: Empresa = {
  nome: '',
  marca: 'DBO',
  cnpj: '',
  documento: '',
  telefone: '',
  email: '',
  endereco: '',
  observacao: '',
  logoDbo: '/logo-dbo.png',
  logoEmpresa: '/logo-empresa.png',
  logoMenu: '/logo-menu.png',
  fundoLogin: '/background-login.jpg',
  regraComissao: 'bruto',
  antecedenciaAgendamento: 0,
};

function slugDaRotaAtual() {
  const seg = String(window.location.pathname || '').split('/').filter(Boolean)[0] || '';
  const reservados = new Set(['login', 'agendar', 'admin', 'admin-master', 'api', 'assets', 'uploads']);
  return seg && !reservados.has(seg) ? seg : '';
}

function empresaSlugAtual() {
  try {
    const usuario = JSON.parse(localStorage.getItem('@sistema_saas_usuario') || 'null');
    return slugDaRotaAtual() || usuario?.empresaSlug || localStorage.getItem('@sistema_saas_empresa_slug') || 'letsbarbearia';
  } catch {
    return slugDaRotaAtual() || localStorage.getItem('@sistema_saas_empresa_slug') || 'letsbarbearia';
  }
}

async function api(path: string, options: RequestInit = {}) {
  const slug = empresaSlugAtual();
  const r = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-empresa-slug': slug, ...(options.headers || {}) },
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Erro na API');
  return j?.data;
}

function carregarConfigLocal(): Partial<Empresa> {
  try {
    return JSON.parse(localStorage.getItem(EMPRESA_CONFIG_KEY) || '{}');
  } catch {
    return {};
  }
}

function arquivoImagemParaDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione apenas arquivos de imagem.'));
      return;
    }

    const tamanhoMaximoMb = 2;
    if (file.size > tamanhoMaximoMb * 1024 * 1024) {
      reject(new Error(`A imagem deve ter no máximo ${tamanhoMaximoMb} MB.`));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    reader.readAsDataURL(file);
  });
}

export default function Configuracoes() {
  const [empresa, setEmpresa] = useState<Empresa>(empresaPadrao);
  const [formas, setFormas] = useState<Forma[]>([]);
  const [forma, setForma] = useState({
    nome: 'Pix',
    tipo: 'Pix',
    chavePix: '',
    observacao: '',
    taxa: '',
  });

  useEffect(() => {
    const local = carregarConfigLocal();

    api('/api/empresa')
      .then((d) => {
        if (d) {
          setEmpresa({
            ...empresaPadrao,
            ...local,
            ...d,
            cnpj: d.documento || d.cnpj || local.cnpj || '',
            documento: d.documento || d.cnpj || local.documento || '',
            logoDbo: d.logoDbo || local.logoDbo || '/logo-dbo.png',
            logoEmpresa: d.logoEmpresa || local.logoEmpresa || '/logo-empresa.png',
            logoMenu: d.logoMenu || local.logoMenu || d.logoEmpresa || local.logoEmpresa || '/logo-menu.png',
            fundoLogin: d.fundoLogin || local.fundoLogin || '/background-login.jpg',
            regraComissao: d.regraComissao || d.comissaoSobre || local.regraComissao || 'bruto',
            antecedenciaAgendamento: Number(d.antecedenciaAgendamento ?? d.antecedencia_agendamento ?? local.antecedenciaAgendamento ?? 0),
          });
        } else {
          setEmpresa({ ...empresaPadrao, ...local });
        }
      })
      .catch(() => setEmpresa({ ...empresaPadrao, ...local }));

    api('/api/formas-pagamento')
      .then((dados) => setFormas(dados || []))
      .catch(() => {});
  }, []);

  const salvarEmpresa = async () => {
    const dadosParaSalvar = {
      ...empresa,
      documento: empresa.documento || empresa.cnpj,
      cnpj: empresa.cnpj || empresa.documento,
    };

    localStorage.setItem(EMPRESA_CONFIG_KEY, JSON.stringify(dadosParaSalvar));

    try {
      // Seu backend atual usa PUT /api/empresa.
      const salvo = await api('/api/empresa', {
        method: 'PUT',
        body: JSON.stringify(dadosParaSalvar),
      }).catch(async () => {
        // Fallback caso alguma versão antiga tenha POST.
        return api('/api/empresa', {
          method: 'POST',
          body: JSON.stringify(dadosParaSalvar),
        });
      });

      setEmpresa({
        ...empresa,
        ...salvo,
        ...dadosParaSalvar,
        cnpj: salvo?.documento || dadosParaSalvar.cnpj,
        documento: salvo?.documento || dadosParaSalvar.documento,
      });

      alert('Configurações salvas.');
    } catch (e: any) {
      // As imagens escolhidas por upload ficam salvas no navegador mesmo se a API antiga não aceitar imagens grandes.
      setEmpresa(dadosParaSalvar);
      alert('Configurações salvas neste navegador. Se o backend não aceitar imagem grande, o sistema continuará usando a imagem neste computador.');
    }
  };

  const salvarForma = async () => {
    try {
      if (!forma.nome) return alert('Informe o nome da forma de pagamento.');

      const nova = await api('/api/formas-pagamento', {
        method: 'POST',
        body: JSON.stringify({
          nome: forma.nome,
          tipo: forma.tipo,
          maquinaNome: forma.tipo,
          maquinaCodigo: forma.chavePix,
          chavePix: forma.chavePix,
          observacao: forma.observacao,
          taxaPercentual: Number(String(forma.taxa || '0').replace(',', '.')) || 0,
          taxa: Number(String(forma.taxa || '0').replace(',', '.')) || 0,
        }),
      });

      setFormas((v) => [nova, ...v]);
      setForma({ nome: 'Pix', tipo: 'Pix', chavePix: '', observacao: '', taxa: '' });
    } catch (e: any) {
      alert('Erro ao salvar forma de pagamento: ' + e.message);
    }
  };

  const excluirForma = async (id: string) => {
    try {
      if (!confirm('Excluir forma de pagamento?')) return;
      await api(`/api/formas-pagamento/${id}`, { method: 'DELETE' });
      setFormas((v) => v.filter((f) => f.id !== id));
    } catch (e: any) {
      alert('Erro ao excluir: ' + e.message);
    }
  };


  const selecionarImagem = async (campo: 'logoEmpresa' | 'logoMenu' | 'fundoLogin', file?: File | null) => {
    try {
      if (!file) return;
      const dataUrl = await arquivoImagemParaDataUrl(file);
      setEmpresa((atual) => ({ ...atual, [campo]: dataUrl }));
    } catch (e: any) {
      alert(e.message || 'Erro ao carregar imagem.');
    }
  };

  const removerImagem = (campo: 'logoEmpresa' | 'logoMenu' | 'fundoLogin', padrao: string) => {
    setEmpresa((atual) => ({ ...atual, [campo]: padrao }));
  };

  const cardImagemUpload = (
    titulo: string,
    campo: 'logoEmpresa' | 'logoMenu' | 'fundoLogin',
    valor: string,
    padrao: string,
    fundo = false,
  ) => (
    <div className="rounded-2xl border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-muted-foreground">{titulo}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => removerImagem(campo, padrao)}
        >
          <X className="mr-1 h-3 w-3" />
          Remover
        </Button>
      </div>

      {fundo ? (
        <div
          className="h-28 rounded-xl bg-secondary/50 bg-cover bg-center"
          style={{ backgroundImage: valor ? `url('${valor}')` : undefined }}
        />
      ) : (
        <div className="flex h-28 items-center justify-center rounded-xl bg-secondary/50 p-2">
          {valor ? <img src={valor} className="max-h-24 max-w-full object-contain" /> : <Eye className="h-6 w-6" />}
        </div>
      )}

      <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed bg-card p-3 text-sm font-semibold hover:bg-secondary/50">
        <Upload className="mr-2 h-4 w-4" />
        Selecionar imagem
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(e) => selecionarImagem(campo, e.target.files?.[0])}
        />
      </label>

      <p className="mt-2 text-xs text-muted-foreground">PNG, JPG ou WEBP até 2 MB.</p>
    </div>
  );

  return (
    <PageShell title="Configurações" subtitle="Dados da empresa, marca da tela de login e formas de pagamento.">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Empresa</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Nome da empresa</Label>
                <Input value={empresa.nome} onChange={(e) => setEmpresa({ ...empresa, nome: e.target.value })} />
              </div>

              <div>
                <Label>Marca / Nome curto</Label>
                <Input value={empresa.marca} onChange={(e) => setEmpresa({ ...empresa, marca: e.target.value })} />
              </div>

              <div>
                <Label>CNPJ/CPF</Label>
                <Input
                  value={empresa.cnpj || empresa.documento}
                  onChange={(e) =>
                    setEmpresa({ ...empresa, cnpj: e.target.value, documento: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Telefone / WhatsApp</Label>
                <Input value={empresa.telefone} onChange={(e) => setEmpresa({ ...empresa, telefone: e.target.value })} />
              </div>

              <div>
                <Label>E-mail</Label>
                <Input value={empresa.email} onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })} />
              </div>

              <div>
                <Label>Endereço</Label>
                <Input value={empresa.endereco} onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })} />
              </div>

              <div className="md:col-span-2">
                <Label>Observações</Label>
                <Textarea value={empresa.observacao} onChange={(e) => setEmpresa({ ...empresa, observacao: e.target.value })} />
              </div>
            </div>
          </div>



          <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
            <div className="mb-4 flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Agendamento online</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Antecedência mínima padrão</Label>
                <Select
                  value={String(empresa.antecedenciaAgendamento ?? 0)}
                  onValueChange={(value) =>
                    setEmpresa({ ...empresa, antecedenciaAgendamento: Number(value) })
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Imediato</SelectItem>
                    <SelectItem value="1">1 hora</SelectItem>
                    <SelectItem value="2">2 horas</SelectItem>
                    <SelectItem value="6">6 horas</SelectItem>
                    <SelectItem value="12">12 horas</SelectItem>
                    <SelectItem value="24">24 horas</SelectItem>
                    <SelectItem value="48">48 horas</SelectItem>
                    <SelectItem value="72">72 horas</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Esta regra vale para todos os profissionais, exceto quando houver prazo específico no cadastro do profissional.
                </p>
              </div>
            </div>

            <Button className="mt-5" onClick={salvarEmpresa}>
              <Save className="mr-1 h-4 w-4" />
              Salvar agendamento online
            </Button>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Configuração de comissão</h2>
            </div>

            <div className="space-y-3">
              <label className="flex cursor-pointer gap-3 rounded-2xl border bg-background p-4">
                <input
                  type="radio"
                  name="regraComissao"
                  value="bruto"
                  checked={empresa.regraComissao === 'bruto'}
                  onChange={() => setEmpresa({ ...empresa, regraComissao: 'bruto' })}
                />
                <div>
                  <p className="font-bold">Comissão sobre valor cheio/bruto</p>
                  <p className="text-sm text-muted-foreground">A taxa do cartão fica por conta da empresa. Ex.: R$ 100,00 com 40% gera R$ 40,00 de comissão.</p>
                </div>
              </label>

              <label className="flex cursor-pointer gap-3 rounded-2xl border bg-background p-4">
                <input
                  type="radio"
                  name="regraComissao"
                  value="liquido"
                  checked={empresa.regraComissao === 'liquido'}
                  onChange={() => setEmpresa({ ...empresa, regraComissao: 'liquido' })}
                />
                <div>
                  <p className="font-bold">Comissão sobre valor deduzido/líquido</p>
                  <p className="text-sm text-muted-foreground">Primeiro desconta a taxa do cartão, depois calcula a comissão.</p>
                </div>
              </label>

              <label className="flex cursor-pointer gap-3 rounded-2xl border bg-background p-4">
                <input
                  type="radio"
                  name="regraComissao"
                  value="dividir_taxa"
                  checked={empresa.regraComissao === 'dividir_taxa'}
                  onChange={() => setEmpresa({ ...empresa, regraComissao: 'dividir_taxa' })}
                />
                <div>
                  <p className="font-bold">Dividir taxa do cartão</p>
                  <p className="text-sm text-muted-foreground">Metade da taxa fica para a empresa e metade reduz a base da comissão do profissional.</p>
                </div>
              </label>
            </div>

            <Button className="mt-5" onClick={salvarEmpresa}>
              <Save className="mr-1 h-4 w-4" />
              Salvar regra de comissão
            </Button>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Imagens e logos</h2>
            </div>

            <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Agora você pode selecionar as imagens direto do computador. A logo DBO fica fixa como marca do sistema.
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border bg-background p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-muted-foreground">Logo DBO</p>
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-muted-foreground">
                    <Lock className="mr-1 h-3 w-3" />
                    Fixa
                  </span>
                </div>
                <div className="flex h-28 items-center justify-center rounded-xl bg-secondary/50 p-2">
                  {empresa.logoDbo ? <img src={empresa.logoDbo} className="max-h-24 max-w-full object-contain" /> : <Eye className="h-6 w-6" />}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Esta imagem continua sendo a marca do DBO Sistema SaaS.</p>
              </div>

              {cardImagemUpload('Logo Empresa', 'logoEmpresa', empresa.logoEmpresa, '/logo-empresa.png')}
              {cardImagemUpload('Logo Menu', 'logoMenu', empresa.logoMenu, '/logo-menu.png')}
              {cardImagemUpload('Fundo Login', 'fundoLogin', empresa.fundoLogin, '/background-login.jpg', true)}
            </div>

            <Button className="mt-5" onClick={salvarEmpresa}>
              <Save className="mr-1 h-4 w-4" />
              Salvar imagens
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Formas de pagamento</h2>
          </div>

          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <Input placeholder="Nome" value={forma.nome} onChange={(e) => setForma({ ...forma, nome: e.target.value })} />

              <select
                className="rounded-xl border bg-background p-3"
                value={forma.tipo}
                onChange={(e) => setForma({ ...forma, tipo: e.target.value })}
              >
                <option>Pix</option>
                <option>Dinheiro</option>
                <option>Débito</option>
                <option>Crédito</option>
                <option>Máquina</option>
                <option>Transferência</option>
                <option>Outro</option>
              </select>
            </div>

            <Input
              placeholder="Chave Pix / código / identificação da máquina"
              value={forma.chavePix}
              onChange={(e) => setForma({ ...forma, chavePix: e.target.value })}
            />

            <Input
              placeholder="Observação"
              value={forma.observacao}
              onChange={(e) => setForma({ ...forma, observacao: e.target.value })}
            />

            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Taxa da maquininha (%) - ex.: 3.49"
              value={forma.taxa}
              onChange={(e) => setForma({ ...forma, taxa: e.target.value })}
            />

            <Button onClick={salvarForma}>
              <Plus className="mr-1 h-4 w-4" />
              Adicionar forma
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {formas.map((f) => (
              <div key={f.id} className="rounded-2xl border bg-secondary/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{f.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.tipo} {f.chavePix || f.maquinaCodigo ? `• ${f.chavePix || f.maquinaCodigo}` : ''} • Taxa: {Number(f.taxaPercentual || f.taxa || 0).toFixed(2)}%
                    </p>
                    {f.observacao && <p className="text-xs text-muted-foreground">{f.observacao}</p>}
                  </div>

                  <Button size="icon" variant="outline" onClick={() => excluirForma(f.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {!formas.length && (
              <p className="rounded-2xl border bg-secondary/30 p-6 text-center text-muted-foreground">
                Nenhuma forma cadastrada.
              </p>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
