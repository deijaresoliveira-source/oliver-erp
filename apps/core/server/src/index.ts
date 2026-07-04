import express from 'express';
import cors from 'cors';

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '8mb' }));

type SistemaTipo = 'beauty' | 'fit' | 'clinic';
type Empresa = {
  id: string; nome: string; slug: string; subdominio: string; sistema: SistemaTipo;
  email?: string; telefone?: string; plano: string; ativo: boolean; ativaAte?: string; diasAviso: number;
  bloqueioMotivo?: string; logoEmpresa?: string; logoMenu?: string; fundoLogin?: string; corPrimaria?: string;
  usuariosTotal: number; clientesTotal: number; agendamentosTotal: number; statusComercial?: string;
  adminEmail?: string; adminNome?: string; adminSenha?: string;
};

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function somarDias(dataIso: string, dias: number) { const d = new Date(`${dataIso}T12:00:00`); d.setDate(d.getDate()+dias); return d.toISOString().slice(0,10); }
function slugify(v: string) { return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60); }
function diasRestantes(ativaAte?: string) { if (!ativaAte) return null; const hoje = new Date(`${hojeISO()}T12:00:00`).getTime(); const fim = new Date(`${String(ativaAte).slice(0,10)}T12:00:00`).getTime(); return Math.ceil((fim-hoje)/(1000*60*60*24)); }
function sistemaPorSegmento(segmento?: string): SistemaTipo { const s = String(segmento||'').toLowerCase(); if (s.includes('academ') || s.includes('fit')) return 'fit'; if (s.includes('clinic') || s.includes('saude') || s.includes('saúde')) return 'clinic'; return 'beauty'; }
function serializar(e: Empresa) { return { ...e, diasRestantes: diasRestantes(e.ativaAte), statusComercial: !e.ativo ? 'Bloqueada' : (diasRestantes(e.ativaAte) ?? 99) < 0 ? 'Vencida' : 'Ativa' }; }

const empresas: Empresa[] = [
  { id:'1', nome:'Neuzelly Estética', slug:'neuzelly', subdominio:'neuzelly', sistema:'beauty', email:'neuzelly@email.com', telefone:'(63) 99999-0001', plano:'Teste', ativo:true, ativaAte:somarDias(hojeISO(),7), diasAviso:7, corPrimaria:'#f6b21a', usuariosTotal:2, clientesTotal:128, agendamentosTotal:342, adminEmail:'admin@neuzelly.com', adminSenha:'123456' },
  { id:'2', nome:'Academia Modelo', slug:'academia', subdominio:'academia', sistema:'fit', email:'academia@email.com', telefone:'(63) 99999-0002', plano:'Mensal', ativo:true, ativaAte:somarDias(hojeISO(),24), diasAviso:7, corPrimaria:'#22c55e', usuariosTotal:4, clientesTotal:297, agendamentosTotal:89, adminEmail:'admin@academia.com', adminSenha:'123456' },
  { id:'3', nome:'Clínica Modelo', slug:'clinica', subdominio:'clinica', sistema:'clinic', email:'clinica@email.com', telefone:'(63) 99999-0003', plano:'Mensal', ativo:true, ativaAte:somarDias(hojeISO(),15), diasAviso:7, corPrimaria:'#38bdf8', usuariosTotal:3, clientesTotal:76, agendamentosTotal:211, adminEmail:'admin@clinica.com', adminSenha:'123456' }
];

app.get('/api/health', (_req, res) => res.json({ ok:true, app:'Oliver ERP Core Demo', port }));
app.post('/api/master/login', (req,res)=> {
  const { email, senha } = req.body ?? {};
  if (!email || !senha) return res.status(400).json({ ok:false, error:'Informe e-mail e senha.' });
  return res.json({ ok:true, data:{ id:'master-1', nome:'Administrador Master', email, perfil:'master', token:'master-demo-token' } });
});
app.get('/api/master/empresas', (_req,res)=> res.json({ ok:true, data: empresas.map(serializar) }));
app.post('/api/master/empresas', (req,res)=> {
  const b = req.body ?? {}; const slug = slugify(b.slug || b.nome);
  if (!b.nome || !slug) return res.status(400).json({ ok:false, error:'Informe nome e slug.' });
  if (empresas.some(e=>e.slug===slug)) return res.status(400).json({ ok:false, error:'Já existe empresa com este slug.' });
  const nova: Empresa = { id:String(Date.now()), nome:b.nome, slug, subdominio:slug, sistema:sistemaPorSegmento(b.segmento || b.plano), email:b.email||b.adminEmail||'', telefone:b.telefone||'', plano:b.plano||'Teste', ativo:b.ativo !== false, ativaAte:b.ativaAte || somarDias(hojeISO(),30), diasAviso:Number(b.diasAviso||7), bloqueioMotivo:b.bloqueioMotivo||'', logoEmpresa:b.logoEmpresa||'', logoMenu:b.logoMenu||'', fundoLogin:b.fundoLogin||'', corPrimaria:b.corPrimaria||'#f6b21a', usuariosTotal:1, clientesTotal:0, agendamentosTotal:0, adminNome:b.adminNome||'', adminEmail:b.adminEmail||b.email||'', adminSenha:b.adminSenha||'123456' };
  empresas.push(nova); res.status(201).json({ ok:true, data:serializar(nova) });
});
app.put('/api/master/empresas/:id', (req,res)=> { const e=empresas.find(x=>x.id===req.params.id); if(!e) return res.status(404).json({ok:false,error:'Empresa não encontrada.'}); Object.assign(e, req.body, { slug: slugify(req.body.slug || e.slug), subdominio: slugify(req.body.slug || e.slug), diasAviso:Number(req.body.diasAviso||e.diasAviso||7) }); res.json({ok:true,data:serializar(e)}); });
app.put('/api/master/empresas/:id/bloquear', (req,res)=> { const e=empresas.find(x=>x.id===req.params.id); if(!e) return res.status(404).json({ok:false,error:'Empresa não encontrada.'}); e.ativo=false; e.bloqueioMotivo=req.body?.motivo||'Bloqueio administrativo.'; res.json({ok:true,data:serializar(e)}); });
app.put('/api/master/empresas/:id/reativar', (req,res)=> { const e=empresas.find(x=>x.id===req.params.id); if(!e) return res.status(404).json({ok:false,error:'Empresa não encontrada.'}); e.ativo=true; e.bloqueioMotivo=''; e.ativaAte=req.body?.ativaAte||somarDias(hojeISO(),30); res.json({ok:true,data:serializar(e)}); });
app.put('/api/master/empresas/:id/renovar', (req,res)=> { const e=empresas.find(x=>x.id===req.params.id); if(!e) return res.status(404).json({ok:false,error:'Empresa não encontrada.'}); const dias=Number(req.body?.dias||30); const base=(diasRestantes(e.ativaAte) ?? -1) > 0 ? e.ativaAte! : hojeISO(); e.ativaAte=somarDias(base,dias); e.ativo=true; e.bloqueioMotivo=''; res.json({ok:true,data:serializar(e)}); });
app.delete('/api/master/empresas/:id', (req,res)=> { const i=empresas.findIndex(x=>x.id===req.params.id); if(i<0) return res.status(404).json({ok:false,error:'Empresa não encontrada.'}); empresas.splice(i,1); res.json({ok:true,data:true}); });

app.post('/api/publico/cadastrar-empresa', (req,res)=> { const b=req.body??{}; const slug=slugify(b.empresaNome); if(!b.empresaNome || !b.responsavelEmail || !b.senha) return res.status(400).json({ok:false,error:'Preencha empresa, e-mail e senha.'}); if(empresas.some(e=>e.slug===slug)) return res.status(400).json({ok:false,error:'Já existe empresa com este nome/slug.'}); const ativaAte=somarDias(hojeISO(),7); const nova:Empresa={ id:String(Date.now()), nome:b.empresaNome, slug, subdominio:slug, sistema:sistemaPorSegmento(b.segmento), email:b.email||b.responsavelEmail, telefone:b.telefone||'', plano:'Teste', ativo:true, ativaAte, diasAviso:7, corPrimaria:'#f6b21a', usuariosTotal:1, clientesTotal:0, agendamentosTotal:0, adminNome:b.responsavelNome, adminEmail:b.responsavelEmail, adminSenha:b.senha }; empresas.push(nova); res.status(201).json({ok:true,data:{ empresaId:nova.id, empresaNome:nova.nome, slug:nova.slug, linkAcesso:`/${nova.slug}/login`, adminEmail:nova.adminEmail, ativaAte:ativaAte.split('-').reverse().join('/') }}); });
app.get('/api/core/empresas', (_req,res)=> res.json(empresas.map(serializar)));
app.get('/api/core/empresa/:slug', (req,res)=> { const e=empresas.find(x=>x.slug===req.params.slug || x.subdominio===req.params.slug); if(!e) return res.status(404).json({message:'Empresa não encontrada'}); res.json(serializar(e)); });
app.post('/api/core/login', (req,res)=> { const { email, senha, empresaSlug }=req.body??{}; const e=empresas.find(x=>x.slug===empresaSlug); if(!e) return res.status(404).json({message:'Empresa não encontrada'}); if(!e.ativo) return res.status(403).json({message:e.bloqueioMotivo||'Empresa bloqueada'}); if(!email || !senha) return res.status(400).json({message:'Informe e-mail e senha.'}); res.json({token:'demo-token-oliver-erp', usuario:{id:1,nome: email.includes('master')?'Administrador Master':'Administrador da Empresa',email,perfil:'admin_empresa'}, empresa:serializar(e)}); });

app.listen(port, () => console.log(`Oliver ERP Core API rodando em http://localhost:${port}`));
