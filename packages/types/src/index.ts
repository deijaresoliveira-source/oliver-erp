export type SistemaTipo = 'beauty' | 'fit' | 'clinic' | 'pet' | 'school';
export type EmpresaStatus = 'ativo' | 'teste' | 'vencido' | 'bloqueado' | 'cancelado';

export interface EmpresaCore {
  id: number;
  nome: string;
  slug: string;
  subdominio: string;
  sistemaTipo: SistemaTipo;
  status: EmpresaStatus;
  planoId: number;
  logoUrl?: string | null;
  corPrimaria?: string | null;
}

export interface UsuarioCore {
  id: number;
  empresaId: number;
  nome: string;
  email: string;
  perfil: 'master' | 'admin' | 'gerente' | 'profissional' | 'usuario';
  status: 'ativo' | 'pendente' | 'bloqueado';
}

export interface PlanoCore {
  id: number;
  nome: string;
  valor: number;
  limiteUsuarios: number;
  ativo: boolean;
}
