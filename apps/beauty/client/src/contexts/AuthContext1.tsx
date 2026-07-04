import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Usuario = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  permissoes: string[];
  profissionalId?: string;
  profissionalNome?: string;
  profissionalApelido?: string;
  empresaId?: string;
  empresaSlug?: string;
  avisoVencimento?: {
    tipo?: string;
    titulo?: string;
    mensagem?: string;
    bloqueado?: boolean;
    diasRestantes?: number | null;
  };
};

type AuthContextData = {
  usuario: Usuario | null;
  carregando: boolean;
  logado: boolean;
  login: (email: string, senha: string, empresaSlug?: string) => Promise<void>;
  logout: () => void;
  pode: (permissao: string) => boolean;
};

const AuthContext = createContext<AuthContextData | null>(null);

const STORAGE_KEY = '@sistema_saas_usuario';
const EMPRESA_SLUG_KEY = '@sistema_saas_empresa_slug';

function slugDaRotaAtual() {
  if (typeof window === 'undefined') return '';
  const seg = String(window.location.pathname || '').split('/').filter(Boolean)[0] || '';
  const reservados = new Set(['login', 'agendar', 'admin', 'admin-master', 'api', 'assets', 'uploads']);
  return seg && !reservados.has(seg) ? seg : '';
}

function empresaSlugAtualGlobal() {
  if (typeof window === 'undefined') return 'letsbarbearia';
  try {
    const usuario = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return slugDaRotaAtual() || usuario?.empresaSlug || localStorage.getItem(EMPRESA_SLUG_KEY) || 'letsbarbearia';
  } catch {
    return slugDaRotaAtual() || localStorage.getItem(EMPRESA_SLUG_KEY) || 'letsbarbearia';
  }
}

function instalarInterceptadorEmpresa() {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (w.__sistemaSaasEmpresaFetchAtivo) return;
  w.__sistemaSaasEmpresaFetchAtivo = true;
  const fetchOriginal = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const deveEnviarEmpresa = String(url || '').startsWith('/api/');
    if (!deveEnviarEmpresa) return fetchOriginal(input, init);

    const headers = new Headers(init.headers || {});
    if (!headers.has('x-empresa-slug')) {
      headers.set('x-empresa-slug', empresaSlugAtualGlobal());
    }

    try {
      const usuario = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (usuario?.id && !headers.has('x-usuario-id')) {
        headers.set('x-usuario-id', String(usuario.id));
      }
    } catch {}

    return fetchOriginal(input, {
      ...init,
      headers,
      credentials: init.credentials || 'same-origin',
    });
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  instalarInterceptadorEmpresa();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      try {
        setUsuario(JSON.parse(salvo));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setCarregando(false);
  }, []);

  const login = async (email: string, senha: string, empresaSlug?: string) => {
    const slug = empresaSlug || localStorage.getItem(EMPRESA_SLUG_KEY) || "letsbarbearia";
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-empresa-slug': slug,
      },
      body: JSON.stringify({ email, senha, empresaSlug: slug }),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || json?.ok === false) {
      throw new Error(json?.error || 'Usuário ou senha inválidos.');
    }

    const usuarioLogado = json.data;
    setUsuario(usuarioLogado);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usuarioLogado));
    localStorage.setItem(EMPRESA_SLUG_KEY, usuarioLogado.empresaSlug || slug);
  };

  const logout = () => {
    setUsuario(null);
    localStorage.removeItem(STORAGE_KEY);
    const slug = usuario?.empresaSlug || localStorage.getItem(EMPRESA_SLUG_KEY) || '';
    window.location.href = slug ? `/${slug}/login` : '/login';
  };

  const pode = (permissao: string) => {
    if (!usuario) return false;
    if (usuario.perfil === 'Administrador') return true;
    return usuario.permissoes?.includes(permissao);
  };

  const value = useMemo(
    () => ({
      usuario,
      carregando,
      logado: Boolean(usuario),
      login,
      logout,
      pode,
    }),
    [usuario, carregando]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}
