import type { Express } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { EMPRESA_ID, execute, fromTime, getEmpresaContext, query, toDateBR, toDateISO, toTime } from "./db";

function ok(res: any, data: any) {
  res.json({ ok: true, data });
}

function fail(res: any, error: any) {
  console.error(error);
  res.status(500).json({ ok: false, error: error?.message || String(error) });
}

const UPLOADS_EMPRESAS_DIR = path.resolve(process.cwd(), "server", "uploads", "empresas");

function imagemDataUrl(valor: any) {
  return typeof valor === "string" && /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(valor);
}

function extensaoImagemDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i);
  const ext = String(match?.[1] || "png").toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

async function salvarImagemEmpresa(empresaId: any, tipo: "logoEmpresa" | "logoMenu" | "fundoLogin", valor: any) {
  if (!valor) return "";

  // Se já for caminho salvo, mantém. Se for base64, grava em arquivo.
  if (!imagemDataUrl(valor)) return String(valor);

  const ext = extensaoImagemDataUrl(String(valor));
  const nomes: Record<string, string> = {
    logoEmpresa: "logo",
    logoMenu: "menu",
    fundoLogin: "fundo",
  };

  const pasta = path.join(UPLOADS_EMPRESAS_DIR, String(empresaId));
  await fs.mkdir(pasta, { recursive: true });

  const nomeArquivo = `${nomes[tipo]}-${Date.now()}.${ext}`;
  const caminhoArquivo = path.join(pasta, nomeArquivo);
  const base64 = String(valor).replace(/^data:image\/(png|jpeg|jpg|webp);base64,/i, "");
  await fs.writeFile(caminhoArquivo, Buffer.from(base64, "base64"));

  return `/uploads/empresas/${empresaId}/${nomeArquivo}`;
}

async function salvarImagensEmpresa(empresaId: any, b: any) {
  const logoEmpresa = await salvarImagemEmpresa(empresaId, "logoEmpresa", b.logoEmpresa || b.logo_empresa || "");
  const logoMenuInformado = b.logoMenu || b.logo_menu || "";
  const logoMenu = logoMenuInformado
    ? await salvarImagemEmpresa(empresaId, "logoMenu", logoMenuInformado)
    : logoEmpresa;
  const fundoLogin = await salvarImagemEmpresa(empresaId, "fundoLogin", b.fundoLogin || b.fundo_login || "");

  return { logoEmpresa, logoMenu, fundoLogin };
}

function mapCliente(row: any) {
  return {
    id: String(row.id),
    nome: row.nome || row.cliente_nome || "",
    telefone: row.telefone || "",
    email: row.email || "",
    observacao: row.observacao || "",
    dataCadastro: row.data_cadastro ? toDateISO(row.data_cadastro) : "",
  };
}

function mapProfissional(row: any) {
  return {
    id: String(row.id),
    nome: row.nome || "",
    apelido: row.apelido || "",
    nomePublico: row.apelido || row.nome || "",
    usuarioId: row.usuario_id ? String(row.usuario_id) : "",
    usuarioNome: row.usuario_nome || "",
    funcao: row.funcao || "Profissional",
    comissao: Number(row.comissao || 0),
    intervaloAgenda: Number(row.intervalo_agenda || row.intervaloAgenda || 30),
    antecedenciaAgendamento: Number(row.antecedencia_agendamento || row.antecedenciaAgendamento || 0),
    metaMensal: Number(row.meta_mensal || row.metaMensal || 0),
    especialidades: row.especialidades || "",
    servicosIds: Array.isArray(row.servicosIds) ? row.servicosIds.map(String) : [],
    ativo: Boolean(row.ativo),
  };
}

function mapServico(row: any) {
  return {
    id: String(row.id),
    nome: row.nome || "",
    valor: Number(row.valor || 0),
    duracao: row.duracao || "",
    categoria: row.categoria || "",
    comissao: Number(row.comissao || 0),
    agendamentoOnline: row.agendamento_online === undefined ? true : Boolean(row.agendamento_online),
  };
}

function mapAgendamento(row: any) {
  return {
    id: String(row.id),
    clienteId: row.cliente_id ? String(row.cliente_id) : "",
    clienteNome: row.cliente_nome || "",
    telefonCliente: row.cliente_telefone || "",
    servicoId: row.servico_id ? String(row.servico_id) : "",
    servicoNome: row.servico_nome || "",
    profissionalId: row.profissional_id ? String(row.profissional_id) : "",
    profissionalNome: row.profissional_nome || "",
    data: toDateBR(row.data_agendamento),
    hora: fromTime(row.hora_agendamento),
    valor: Number(row.valor || 0),
    formaPagamento: row.forma_pagamento || "Pix",
    status: row.status || "Agendado",
    observacao: row.observacao || "",
    assinaturaId: row.assinatura_id ? String(row.assinatura_id) : "",
    pago: Boolean(row.assinatura_paga) || String(row.observacao || "").includes("ASSINATURA PAGA"),
  };
}

function mapFila(row: any) {
  return {
    id: String(row.id),
    clienteId: row.cliente_id ? String(row.cliente_id) : "",
    clienteNome: row.cliente_nome || "",
    telefone: row.cliente_telefone || "",
    servicoId: row.servico_id ? String(row.servico_id) : "",
    servicoNome: row.servico_nome || "",
    profissionalId: row.profissional_id ? String(row.profissional_id) : "",
    profissionalNome: row.profissional_nome || "",
    chegada: row.chegada ? new Date(row.chegada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
    status: row.status || "Aguardando",
    observacao: row.observacao || "",
  };
}


function mapHorarioTrabalho(row: any) {
  return {
    id: row.id ? String(row.id) : undefined,
    profissionalId: row.profissional_id ? String(row.profissional_id) : "",
    diaSemana: row.dia_semana || "Segunda",
    ativo: Boolean(row.ativo),
    inicio: fromTime(row.hora_inicio),
    fim: fromTime(row.hora_fim),
    intervaloInicio: fromTime(row.almoco_inicio),
    intervaloFim: fromTime(row.almoco_fim),
  };
}


const DIAS_SEMANA_TRABALHO = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

function horarioPadraoDoDia(profissionalId: any, diaSemana: string) {
  return {
    profissionalId: String(profissionalId || ""),
    diaSemana,
    ativo: diaSemana !== "Domingo",
    inicio: "08:00",
    fim: diaSemana === "Sábado" ? "13:00" : "18:00",
    intervaloInicio: diaSemana === "Sábado" || diaSemana === "Domingo" ? "" : "12:00",
    intervaloFim: diaSemana === "Sábado" || diaSemana === "Domingo" ? "" : "13:30",
  };
}

function diaSemanaBR(dataISO: string) {
  const data = new Date(`${dataISO}T12:00:00`);
  const diasCalendario = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return diasCalendario[data.getDay()];
}

async function ensureProfissionaisColumns() {
  await execute("ALTER TABLE profissionais ADD COLUMN intervalo_agenda INT NOT NULL DEFAULT 30").catch(() => undefined);
  await execute("ALTER TABLE profissionais ADD COLUMN antecedencia_agendamento INT NOT NULL DEFAULT 0").catch(() => undefined);
  await execute("ALTER TABLE profissionais ADD COLUMN meta_mensal DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
  await execute("ALTER TABLE profissionais ADD COLUMN especialidades TEXT NULL").catch(() => undefined);
  await execute("ALTER TABLE profissionais ADD COLUMN usuario_id INT NULL").catch(() => undefined);
  await execute("ALTER TABLE profissionais ADD COLUMN apelido VARCHAR(120) NULL").catch(() => undefined);
  await execute("CREATE INDEX idx_profissionais_usuario_id ON profissionais (usuario_id)").catch(() => undefined);
  await ensureProfissionalServicosTable();
}

async function ensureProfissionalServicosTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS profissional_servicos (
      empresa_id INT NOT NULL,
      profissional_id INT NOT NULL,
      servico_id INT NOT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (empresa_id, profissional_id, servico_id)
    )
  `).catch(() => undefined);
}

function normalizarServicosIds(valor: any): string[] {
  if (Array.isArray(valor)) return valor.map(String).map((v) => v.trim()).filter(Boolean);
  if (typeof valor === "string") {
    const texto = valor.trim();
    if (!texto) return [];
    try {
      const json = JSON.parse(texto);
      if (Array.isArray(json)) return json.map(String).map((v) => v.trim()).filter(Boolean);
    } catch {}
    return texto.split(",").map((v) => v.trim()).filter(Boolean);
  }
  if (valor) return [String(valor)];
  return [];
}

// Mantém compatibilidade com chamadas antigas do arquivo.
async function ensureProfissionaisIntervaloAgendaColumn() {
  await ensureProfissionaisColumns();
}

function intervaloAgendaValido(valor: any) {
  const intervalo = Number(valor || 30);
  return [15, 20, 25, 30, 35].includes(intervalo) ? intervalo : 30;
}

export function registerApiRoutes(app: Express) {

  async function servicosIdsPorProfissional(profissionaisRows: any[]) {
    await ensureProfissionalServicosTable();
    const ids = profissionaisRows.map((p: any) => String(p.id)).filter(Boolean);
    const mapa = new Map<string, string[]>();
    for (const id of ids) mapa.set(id, []);
    if (!ids.length) return mapa;

    const rows = await query(
      `SELECT profissional_id, servico_id
         FROM profissional_servicos
        WHERE empresa_id = ?
          AND profissional_id IN (${ids.map(() => "?").join(",")})`,
      [EMPRESA_ID, ...ids]
    ).catch(() => []);

    for (const r of rows) {
      const profissionalId = String(r.profissional_id);
      const lista = mapa.get(profissionalId) || [];
      lista.push(String(r.servico_id));
      mapa.set(profissionalId, lista);
    }

    return mapa;
  }

  async function mapProfissionaisComServicos(profissionaisRows: any[]) {
    const mapa = await servicosIdsPorProfissional(profissionaisRows);
    return profissionaisRows.map((p: any) => ({
      ...mapProfissional({ ...p, servicosIds: mapa.get(String(p.id)) || [] }),
    }));
  }

  async function salvarServicosDoProfissional(profissionalId: any, servicosIdsRecebidos: any) {
    await ensureProfissionalServicosTable();
    const servicosIds = [...new Set(normalizarServicosIds(servicosIdsRecebidos))];

    await execute(
      "DELETE FROM profissional_servicos WHERE empresa_id = ? AND profissional_id = ?",
      [EMPRESA_ID, profissionalId]
    );

    for (const servicoId of servicosIds) {
      await execute(
        "INSERT IGNORE INTO profissional_servicos (empresa_id, profissional_id, servico_id) VALUES (?, ?, ?)",
        [EMPRESA_ID, profissionalId, servicoId]
      );
    }

    return servicosIds;
  }

  async function profissionalExecutaServicos(profissionalId: any, servicosIds: string[]) {
    await ensureProfissionalServicosTable();
    const ids = [...new Set(servicosIds.map(String).filter(Boolean))];
    if (!ids.length) return false;

    const rows = await query(
      `SELECT servico_id
         FROM profissional_servicos
        WHERE empresa_id = ?
          AND profissional_id = ?
          AND servico_id IN (${ids.map(() => "?").join(",")})`,
      [EMPRESA_ID, profissionalId, ...ids]
    ).catch(() => []);

    return rows.length === ids.length;
  }

  async function garantirHorariosProfissional(profissionalId: any) {
    await ensureProfissionaisIntervaloAgendaColumn();
    const id = String(profissionalId || "");
    if (!id) return;

    for (const diaSemana of DIAS_SEMANA_TRABALHO) {
      const existente = await query(
        "SELECT id FROM horarios_trabalho WHERE empresa_id = ? AND profissional_id = ? AND dia_semana = ? LIMIT 1",
        [EMPRESA_ID, id, diaSemana]
      ).catch(() => []);

      if (!existente[0]) {
        const padrao = horarioPadraoDoDia(id, diaSemana);
        await execute(
          `INSERT INTO horarios_trabalho
           (empresa_id, profissional_id, dia_semana, ativo, hora_inicio, hora_fim, almoco_inicio, almoco_fim)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            EMPRESA_ID,
            id,
            diaSemana,
            padrao.ativo ? 1 : 0,
            toTime(padrao.inicio),
            toTime(padrao.fim),
            padrao.intervaloInicio ? toTime(padrao.intervaloInicio) : null,
            padrao.intervaloFim ? toTime(padrao.intervaloFim) : null,
          ]
        ).catch(() => undefined);
      }
    }
  }

  async function garantirHorariosTodosProfissionais() {
    const profissionaisRows = await query(
      "SELECT id FROM profissionais WHERE empresa_id = ? AND ativo = 1",
      [EMPRESA_ID]
    ).catch(() => []);

    for (const profissional of profissionaisRows) {
      await garantirHorariosProfissional(profissional.id);
    }
  }

  async function validarHorarioAgendamento(b: any) {
    const profissionalId = b.profissionalId || b.profissional_id;
    const dataISO = toDateISO(b.data);
    const hora = b.hora || b.hora_agendamento;

    if (!profissionalId || !dataISO || !hora) return;

    await garantirHorariosProfissional(profissionalId);

    const diaSemana = diaSemanaBR(dataISO);
    const rows = await query(
      `SELECT * FROM horarios_trabalho
       WHERE empresa_id = ?
       AND profissional_id = ?
       AND dia_semana = ?
       LIMIT 1`,
      [EMPRESA_ID, profissionalId, diaSemana]
    );

    const regra = rows[0];

    if (!regra || Number(regra.ativo) !== 1) {
      throw new Error(`O profissional não atende em ${diaSemana}.`);
    }

    const horaMin = Number(String(hora).slice(0, 2)) * 60 + Number(String(hora).slice(3, 5));
    const inicioMin = Number(fromTime(regra.hora_inicio).slice(0, 2)) * 60 + Number(fromTime(regra.hora_inicio).slice(3, 5));
    const fimMin = Number(fromTime(regra.hora_fim).slice(0, 2)) * 60 + Number(fromTime(regra.hora_fim).slice(3, 5));

    if (horaMin < inicioMin || horaMin >= fimMin) {
      throw new Error(`O horário ${hora} está fora do expediente de ${diaSemana}.`);
    }

    const intervaloInicio = fromTime(regra.almoco_inicio);
    const intervaloFim = fromTime(regra.almoco_fim);

    if (intervaloInicio && intervaloFim) {
      const intInicioMin = Number(intervaloInicio.slice(0, 2)) * 60 + Number(intervaloInicio.slice(3, 5));
      const intFimMin = Number(intervaloFim.slice(0, 2)) * 60 + Number(intervaloFim.slice(3, 5));

      if (horaMin >= intInicioMin && horaMin < intFimMin) {
        throw new Error(`O horário ${hora} está dentro do intervalo do profissional.`);
      }
    }
  }


  // =========================
  // MULTIEMPRESA / ADMIN MASTER
  // =========================
  async function ensureMultiEmpresaTables() {
    await execute(`
      CREATE TABLE IF NOT EXISTS empresas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        marca VARCHAR(150) NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(150) NULL,
        telefone VARCHAR(40) NULL,
        documento VARCHAR(40) NULL,
        endereco TEXT NULL,
        observacao TEXT NULL,
        logo_dbo LONGTEXT NULL,
        logo_empresa LONGTEXT NULL,
        logo_menu LONGTEXT NULL,
        fundo_login LONGTEXT NULL,
        cor_primaria VARCHAR(20) NULL,
        regra_comissao VARCHAR(40) NOT NULL DEFAULT 'bruto',
        plano VARCHAR(50) NOT NULL DEFAULT 'Teste',
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        ativa_ate DATE NULL,
        dias_aviso INT NOT NULL DEFAULT 7,
        bloqueio_motivo TEXT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => undefined);

    await execute("ALTER TABLE empresas ADD COLUMN marca VARCHAR(150) NULL").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN slug VARCHAR(100) NULL").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN logo_dbo LONGTEXT NULL").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN logo_empresa LONGTEXT NULL").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN logo_menu LONGTEXT NULL").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN fundo_login LONGTEXT NULL").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN cor_primaria VARCHAR(20) NULL").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN regra_comissao VARCHAR(40) NOT NULL DEFAULT 'bruto'").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN plano VARCHAR(50) NOT NULL DEFAULT 'Teste'").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN ativa_ate DATE NULL").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN dias_aviso INT NOT NULL DEFAULT 7").catch(() => undefined);
    await execute("ALTER TABLE empresas ADD COLUMN bloqueio_motivo TEXT NULL").catch(() => undefined);

    await execute(`
      CREATE TABLE IF NOT EXISTS administradores_master (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => undefined);

    const empresaRows = await query("SELECT id FROM empresas WHERE slug = 'letsbarbearia' LIMIT 1").catch(() => []);
    if (!empresaRows[0]) {
      await execute(`
        INSERT INTO empresas (nome, marca, slug, email, plano, ativo, ativa_ate, dias_aviso, logo_dbo, logo_empresa, logo_menu, fundo_login)
        VALUES ('LetsBarbearia', 'LetsBarbearia', 'letsbarbearia', 'deijares@gmail.com', 'Teste', 1, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 7, '/logo-dbo.png', '/logo-empresa.png', '/logo-menu.png', '/background-login.jpg')
      `).catch(() => undefined);
    }

    await execute(`
      INSERT IGNORE INTO administradores_master (nome, email, senha, ativo)
      VALUES ('DEIJARES OLIVEIRA', 'deijares@gmail.com', '130312', 1)
    `).catch(() => undefined);
  }

  function dataIsoEmpresa(valor: any) {
    if (!valor) return "";
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
    return String(valor).slice(0, 10);
  }

  function diasRestantesAte(data: any) {
    const iso = dataIsoEmpresa(data);
    if (!iso) return null;
    const hoje = new Date(new Date().toISOString().slice(0, 10) + "T12:00:00");
    const alvo = new Date(iso + "T12:00:00");
    return Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000);
  }

  function avisoEmpresa(e: any) {
    const dias = diasRestantesAte(e?.ativa_ate);
    const diasAviso = Number(e?.dias_aviso || 7);
    if (Number(e?.ativo || 0) !== 1) {
      return {
        bloqueado: true,
        tipo: "bloqueado",
        titulo: "Acesso temporariamente bloqueado",
        mensagem: e?.bloqueio_motivo || "Entre em contato com o suporte para reativação.",
        diasRestantes: dias,
      };
    }
    if (dias !== null && dias < 0) {
      return {
        bloqueado: true,
        tipo: "vencido",
        titulo: "Acesso temporariamente bloqueado",
        mensagem: `Sua assinatura venceu em ${toDateBR(e.ativa_ate)}. Entre em contato com o suporte para reativação.`,
        diasRestantes: dias,
      };
    }
    if (dias !== null && dias <= diasAviso) {
      return {
        bloqueado: false,
        tipo: dias <= 3 ? "critico" : "aviso",
        titulo: dias === 0 ? "Seu acesso vence hoje" : `Seu acesso vencerá em ${dias} dia(s)`,
        mensagem: `Data de vencimento: ${toDateBR(e.ativa_ate)}. Entre em contato com o suporte para renovar sua assinatura.`,
        diasRestantes: dias,
      };
    }
    return { bloqueado: false, tipo: "ok", titulo: "", mensagem: "", diasRestantes: dias };
  }

  function mapEmpresaMaster(e: any) {
    const aviso = avisoEmpresa(e);
    return {
      id: String(e.id),
      nome: e.nome || '',
      slug: e.slug || '',
      email: e.email || '',
      telefone: e.telefone || '',
      plano: e.plano || 'Teste',
      ativo: Boolean(e.ativo),
      ativaAte: dataIsoEmpresa(e.ativa_ate),
      diasAviso: Number(e.dias_aviso || 7),
      bloqueioMotivo: e.bloqueio_motivo || '',
      logoDbo: e.logo_dbo || '/logo-dbo.png',
      logoEmpresa: e.logo_empresa || '',
      logoMenu: e.logo_menu || '',
      fundoLogin: e.fundo_login || '',
      corPrimaria: e.cor_primaria || '#f6b21a',
      regraComissao: e.regra_comissao || 'bruto',
      usuariosTotal: Number(e.usuarios_total || 0),
      clientesTotal: Number(e.clientes_total || 0),
      agendamentosTotal: Number(e.agendamentos_total || 0),
      diasRestantes: aviso.diasRestantes,
      statusComercial: aviso.tipo,
      avisoVencimento: aviso,
    };
  }


  function slugCadastroEmpresa(valor: any) {
    const slug = String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    return slug || `empresa-${Date.now()}`;
  }

  async function slugEmpresaDisponivel(baseSlug: string) {
    let slug = slugCadastroEmpresa(baseSlug);
    let tentativa = 1;

    while (true) {
      const existente = await query("SELECT id FROM empresas WHERE slug = ? LIMIT 1", [slug]).catch(() => []);
      if (!existente[0]) return slug;

      tentativa += 1;
      slug = `${slugCadastroEmpresa(baseSlug)}-${tentativa}`;
    }
  }

  function dataBRPublica(valor: any) {
    return valor ? toDateBR(valor) : "";
  }


  app.post("/api/publico/cadastrar-empresa", async (req, res) => {
    try {
      await ensureMultiEmpresaTables();

      const b = req.body || {};
      const empresaNome = String(b.empresaNome || b.nomeEmpresa || b.nome || "").trim();
      const segmento = String(b.segmento || "Teste").trim();
      const documento = String(b.documento || "").trim();
      const telefone = String(b.telefone || "").trim();
      const emailEmpresa = String(b.email || "").trim().toLowerCase();
      const cidade = String(b.cidade || "").trim();
      const uf = String(b.uf || "").trim().toUpperCase().slice(0, 2);
      const responsavelNome = String(b.responsavelNome || b.adminNome || "").trim();
      const responsavelEmail = String(b.responsavelEmail || b.adminEmail || "").trim().toLowerCase();
      const senha = String(b.senha || "").trim();
      const confirmarSenha = String(b.confirmarSenha || "").trim();
      const aceitarTermos = Boolean(b.aceitarTermos);

      if (!empresaNome) throw new Error("Informe o nome da empresa.");
      if (!responsavelNome) throw new Error("Informe o nome do responsável.");
      if (!telefone) throw new Error("Informe o WhatsApp.");
      if (!responsavelEmail) throw new Error("Informe o e-mail de acesso.");
      if (!senha) throw new Error("Informe uma senha.");
      if (senha.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
      if (senha !== confirmarSenha) throw new Error("As senhas não conferem.");
      if (!aceitarTermos) throw new Error("Confirme que está ciente do período de teste.");

      const slugBase = slugCadastroEmpresa(empresaNome);
      const slug = await slugEmpresaDisponivel(slugBase);

      const emailJaUsado = await query(
        `SELECT u.id FROM usuarios u WHERE u.email = ? LIMIT 1`,
        [responsavelEmail]
      ).catch(() => []);

      if (emailJaUsado[0]) {
        throw new Error("Este e-mail já está cadastrado em outra empresa.");
      }

      const observacao = [
        "Cadastro solicitado pela tela pública de teste grátis.",
        segmento ? `Segmento: ${segmento}` : "",
        cidade || uf ? `Local: ${cidade}${cidade && uf ? "/" : ""}${uf}` : "",
        "Teste liberado automaticamente por 7 dias.",
        "Renovação somente mediante confirmação de pagamento pelo administrador master.",
      ].filter(Boolean).join("\n");

      const result = await execute(
        `INSERT INTO empresas
         (nome, marca, slug, email, telefone, documento, endereco, observacao, plano, ativo, ativa_ate, dias_aviso, bloqueio_motivo, logo_dbo, logo_empresa, logo_menu, fundo_login, cor_primaria)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Teste', 1, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 2, NULL, '/logo-dbo.png', NULL, NULL, NULL, '#f6b21a')`,
        [
          empresaNome,
          empresaNome,
          slug,
          emailEmpresa || responsavelEmail,
          telefone,
          documento || null,
          cidade || uf ? `${cidade}${cidade && uf ? "/" : ""}${uf}` : null,
          observacao,
        ]
      );

      await ensureAuthTables();

      await execute(
        `INSERT INTO usuarios (empresa_id, nome, email, senha, telefone, perfil, ativo, status)
         VALUES (?, ?, ?, ?, ?, 'Administrador', 1, 'ATIVO')`,
        [result.insertId, responsavelNome, responsavelEmail, senha, telefone || null]
      );

      const protocoloRows = await query(
        `SELECT id, nome, slug, ativa_ate FROM empresas WHERE id = ? LIMIT 1`,
        [result.insertId]
      );

      const protocolo = protocoloRows[0] || {};
      const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
        .split(",")[0]
        .trim()
        .replace(/:\d+$/, "");
      const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https");
      const origem = host ? `${proto}://${host}` : "";
      const isLocal = !host || host === "localhost" || host.startsWith("127.");
      const dominioBase = host.replace(/^www\./, "");
      const linkAcesso = isLocal ? `${origem}/${slug}/login` : `${proto}://${slug}.${dominioBase}/login`;

      ok(res, {
        empresaId: String(result.insertId),
        empresaNome: protocolo.nome || empresaNome,
        slug,
        linkAcesso,
        adminEmail: responsavelEmail,
        ativaAte: dataBRPublica(protocolo.ativa_ate),
        plano: "Teste",
        diasTeste: 7,
      });
    } catch (error) {
      fail(res, error);
    }
  });

  // =========================
  // LOGIN / USUÁRIOS / PERMISSÕES
  // =========================
  async function ensureAuthTables() {
    await ensureMultiEmpresaTables();
    await execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        empresa_id INT NOT NULL DEFAULT 1,
        nome VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL,
        senha VARCHAR(255) NOT NULL,
        perfil VARCHAR(40) NOT NULL DEFAULT 'Profissional',
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        status VARCHAR(20) NOT NULL DEFAULT 'ATIVO',
        telefone VARCHAR(40) NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_usuario_email (empresa_id, email)
      )
    `).catch(() => undefined);

    await execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ATIVO'").catch(() => undefined);
    await execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(40) NULL").catch(() => undefined);
    await execute("UPDATE usuarios SET status = 'ATIVO' WHERE status IS NULL OR status = ''").catch(() => undefined);

    await execute(`
      CREATE TABLE IF NOT EXISTS permissoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codigo VARCHAR(80) NOT NULL UNIQUE,
        nome VARCHAR(150) NOT NULL
      )
    `).catch(() => undefined);

    await execute(`
      CREATE TABLE IF NOT EXISTS usuario_permissoes (
        usuario_id INT NOT NULL,
        permissao_codigo VARCHAR(80) NOT NULL,
        PRIMARY KEY (usuario_id, permissao_codigo)
      )
    `).catch(() => undefined);

    await execute(
      `INSERT IGNORE INTO usuarios (empresa_id, nome, email, senha, perfil, ativo, status)
       VALUES (?, 'Administrador', 'admin@sistema.com', 'admin123', 'Administrador', 1, 'ATIVO')`,
      [EMPRESA_ID]
    ).catch(() => undefined);

    await execute(
      `INSERT IGNORE INTO usuarios (empresa_id, nome, email, senha, perfil, ativo, status)
       VALUES (?, 'DEIJARES OLIVEIRA', 'deijares@gmail.com', '130312', 'Administrador', 1, 'ATIVO')`,
      [EMPRESA_ID]
    ).catch(() => undefined);
  }

  function normalizarPermissoes(valor: any): string[] {
    if (Array.isArray(valor)) return valor.map(String).filter(Boolean);
    if (typeof valor === 'string') {
      try {
        const j = JSON.parse(valor);
        if (Array.isArray(j)) return j.map(String).filter(Boolean);
      } catch {}
      return valor.split(',').map((p) => p.trim()).filter(Boolean);
    }
    return [];
  }

  async function permissoesUsuario(usuarioId: any) {
    const rows = await query(
      'SELECT permissao_codigo FROM usuario_permissoes WHERE usuario_id = ?',
      [usuarioId]
    );
    return rows.map((r: any) => r.permissao_codigo);
  }

  async function usuarioDaRequisicao(req: any) {
    await ensureAuthTables();
    const usuarioId = String(req.headers?.['x-usuario-id'] || '').trim();
    if (!usuarioId) return null;

    const rows = await query(
      `SELECT u.*, p.id AS profissional_id, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome, p.apelido AS profissional_apelido
         FROM usuarios u
         LEFT JOIN profissionais p
           ON p.empresa_id = u.empresa_id
          AND p.usuario_id = u.id
          AND p.ativo = 1
        WHERE u.id = ?
          AND u.empresa_id = ?
        LIMIT 1`,
      [usuarioId, EMPRESA_ID]
    ).catch(() => []);

    const usuario = rows[0];
    if (!usuario) return null;
    const permissoes = usuario.perfil === 'Administrador' ? [] : await permissoesUsuario(usuario.id).catch(() => []);

    return {
      id: String(usuario.id),
      perfil: usuario.perfil || 'Profissional',
      profissionalId: usuario.profissional_id ? String(usuario.profissional_id) : '',
      profissionalNome: usuario.profissional_nome || '',
      profissionalApelido: usuario.profissional_apelido || '',
      permissoes,
    };
  }

  function temPermissaoUsuario(usuario: any, permissao: string) {
    if (!usuario) return false;
    if (usuario.perfil === 'Administrador') return true;
    return Array.isArray(usuario.permissoes) && usuario.permissoes.includes(permissao);
  }

  function deveFiltrarFinanceiroProprio(usuario: any) {
    return Boolean(
      usuario &&
      usuario.perfil !== 'Administrador' &&
      usuario.profissionalId &&
      (
        temPermissaoUsuario(usuario, 'financeiro.proprio.ver') ||
        temPermissaoUsuario(usuario, 'financeiro.proprio.comissoes') ||
        temPermissaoUsuario(usuario, 'financeiro.proprio.atendimentos')
      )
    );
  }

  function deveFiltrarAgendaPropria(usuario: any) {
    return Boolean(
      usuario &&
      usuario.perfil !== 'Administrador' &&
      usuario.profissionalId &&
      temPermissaoUsuario(usuario, 'agenda.ver_apenas_minha')
    );
  }

  function deveFiltrarClientesProprios(usuario: any) {
    return Boolean(
      usuario &&
      usuario.perfil !== 'Administrador' &&
      usuario.profissionalId &&
      temPermissaoUsuario(usuario, 'clientes.proprio.ver')
    );
  }

  async function salvarPermissoesUsuario(usuarioId: any, permissoesRecebidas: any) {
    const permissoes = normalizarPermissoes(permissoesRecebidas);
    await execute('DELETE FROM usuario_permissoes WHERE usuario_id = ?', [usuarioId]);

    for (const permissao of permissoes) {
      await execute(
        'INSERT IGNORE INTO usuario_permissoes (usuario_id, permissao_codigo) VALUES (?, ?)',
        [usuarioId, permissao]
      );
    }

    return permissoes;
  }

  function mapUsuarioComPermissoes(u: any, permissoes: string[] = []) {
    return {
      id: String(u.id),
      nome: u.nome || '',
      email: u.email || '',
      telefone: u.telefone || '',
      perfil: u.perfil || 'Profissional',
      profissionalId: u.profissional_id ? String(u.profissional_id) : '',
      profissionalNome: u.profissional_nome || '',
      profissionalApelido: u.profissional_apelido || '',
      ativo: Boolean(u.ativo),
      status: u.status || (u.ativo ? 'ATIVO' : 'PENDENTE'),
      criadoEm: u.criado_em ? new Date(u.criado_em).toISOString() : '',
      permissoes: u.perfil === 'Administrador' ? [] : permissoes,
    };
  }

  app.post('/api/auth/login', async (req, res) => {
    try {
      await ensureAuthTables();
      const b = req.body || {};
      const empresaCtxLogin = getEmpresaContext();
      const empresaRowsLogin = await query('SELECT * FROM empresas WHERE id = ? LIMIT 1', [empresaCtxLogin.empresaId]);
      const empresaLogin = empresaRowsLogin[0];
      if (!empresaLogin) {
        res.status(404).json({ ok: false, error: 'Empresa não encontrada.' });
        return;
      }
      const avisoLogin = avisoEmpresa(empresaLogin);
      if (avisoLogin.bloqueado) {
        res.status(403).json({ ok: false, error: avisoLogin.mensagem || 'Empresa bloqueada.', avisoVencimento: avisoLogin });
        return;
      }
      const rows = await query(
        `SELECT u.*, p.id AS profissional_id, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome, p.apelido AS profissional_apelido
           FROM usuarios u
           LEFT JOIN profissionais p
             ON p.empresa_id = u.empresa_id
            AND p.usuario_id = u.id
            AND p.ativo = 1
          WHERE u.empresa_id = ?
            AND u.email = ?
            AND u.senha = ?
          LIMIT 1`,
        [empresaCtxLogin.empresaId, b.email || '', b.senha || '']
      );

      if (!rows[0]) {
        res.status(401).json({ ok: false, error: 'Usuário ou senha inválidos.' });
        return;
      }

      const u = rows[0];
      if (u.status === 'PENDENTE' || Number(u.ativo) !== 1) {
        res.status(403).json({ ok: false, error: 'Seu acesso ainda está aguardando autorização do administrador.' });
        return;
      }
      if (u.status === 'REJEITADO') {
        res.status(403).json({ ok: false, error: 'Sua solicitação de acesso foi recusada.' });
        return;
      }

      const empresaCtx = getEmpresaContext();
      res.setHeader("Set-Cookie", [
        `empresa_id=${empresaCtx.empresaId}; Path=/; SameSite=Lax`,
        `empresa_slug=${encodeURIComponent(empresaCtx.empresaSlug || "")}; Path=/; SameSite=Lax`,
      ]);

      ok(res, {
        ...mapUsuarioComPermissoes(u, await permissoesUsuario(u.id)),
        empresaId: String(empresaCtx.empresaId),
        empresaSlug: empresaCtx.empresaSlug || "",
        avisoVencimento: avisoLogin,
      });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post('/api/solicitar-acesso', async (req, res) => {
    try {
      await ensureAuthTables();
      const b = req.body || {};
      const nome = String(b.nome || '').trim();
      const email = String(b.email || '').trim();
      const senha = String(b.senha || '').trim();
      const telefone = String(b.telefone || '').trim();

      if (!nome) throw new Error('Informe o nome.');
      if (!email) throw new Error('Informe o e-mail.');
      if (!senha) throw new Error('Informe a senha.');

      const existente = await query(
        'SELECT id, status, ativo FROM usuarios WHERE empresa_id = ? AND email = ? LIMIT 1',
        [EMPRESA_ID, email]
      );
      if (existente[0]) {
        throw new Error('Já existe usuário ou solicitação com este e-mail.');
      }

      const result = await execute(
        `INSERT INTO usuarios (empresa_id, nome, email, senha, telefone, perfil, ativo, status)
         VALUES (?, ?, ?, ?, ?, 'Profissional', 0, 'PENDENTE')`,
        [EMPRESA_ID, nome, email, senha, telefone || null]
      );

      const rows = await query('SELECT * FROM usuarios WHERE id = ? AND empresa_id = ?', [result.insertId, EMPRESA_ID]);
      ok(res, mapUsuarioComPermissoes(rows[0], []));
    } catch (error) {
      fail(res, error);
    }
  });

  app.get('/api/usuarios-pendentes', async (_req, res) => {
    try {
      await ensureAuthTables();
      const rows = await query(
        `SELECT u.id, u.nome, u.email, u.telefone, u.perfil, u.ativo, u.status, u.criado_em,
                p.id AS profissional_id, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome, p.apelido AS profissional_apelido
           FROM usuarios u
           LEFT JOIN profissionais p ON p.empresa_id = u.empresa_id AND p.usuario_id = u.id AND p.ativo = 1
          WHERE u.empresa_id = ? AND u.status = 'PENDENTE'
          ORDER BY u.criado_em DESC, u.id DESC`,
        [EMPRESA_ID]
      );
      ok(res, rows.map((u: any) => mapUsuarioComPermissoes(u, [])));
    } catch (error) {
      fail(res, error);
    }
  });

  app.get('/api/usuarios', async (_req, res) => {
    try {
      await ensureAuthTables();
      const rows = await query(
        `SELECT u.id, u.nome, u.email, u.telefone, u.perfil, u.ativo, u.status, u.criado_em,
                p.id AS profissional_id, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome, p.apelido AS profissional_apelido
           FROM usuarios u
           LEFT JOIN profissionais p ON p.empresa_id = u.empresa_id AND p.usuario_id = u.id AND p.ativo = 1
          WHERE u.empresa_id = ? AND u.status <> 'PENDENTE'
          ORDER BY u.nome`,
        [EMPRESA_ID]
      );

      const lista = [];
      for (const u of rows) {
        lista.push(mapUsuarioComPermissoes(u, await permissoesUsuario(u.id)));
      }

      ok(res, lista);
    } catch (error) {
      fail(res, error);
    }
  });

  app.post('/api/usuarios', async (req, res) => {
    try {
      await ensureAuthTables();
      const b = req.body || {};
      if (!b.nome || !b.email) throw new Error('Informe nome e email.');
      const result = await execute(
        "INSERT INTO usuarios (empresa_id, nome, email, senha, perfil, ativo, status) VALUES (?, ?, ?, ?, ?, 1, 'ATIVO')",
        [EMPRESA_ID, b.nome || '', b.email || '', b.senha || '123456', b.perfil || 'Profissional']
      );

      const permissoesSalvas = await salvarPermissoesUsuario(result.insertId, b.permissoes);
      const rows = await query('SELECT * FROM usuarios WHERE id = ? AND empresa_id = ?', [result.insertId, EMPRESA_ID]);
      ok(res, mapUsuarioComPermissoes(rows[0], permissoesSalvas));
    } catch (error) {
      fail(res, error);
    }
  });

  app.put('/api/usuarios/:id', async (req, res) => {
    try {
      await ensureAuthTables();
      const b = req.body || {};

      if (b.senha) {
        await execute(
          'UPDATE usuarios SET nome=?, email=?, senha=?, perfil=?, status=?, ativo=? WHERE id=? AND empresa_id=?',
          [b.nome || '', b.email || '', b.senha, b.perfil || 'Profissional', b.status || 'ATIVO', b.ativo === false ? 0 : 1, req.params.id, EMPRESA_ID]
        );
      } else {
        await execute(
          'UPDATE usuarios SET nome=?, email=?, perfil=?, status=?, ativo=? WHERE id=? AND empresa_id=?',
          [b.nome || '', b.email || '', b.perfil || 'Profissional', b.status || 'ATIVO', b.ativo === false ? 0 : 1, req.params.id, EMPRESA_ID]
        );
      }

      const permissoesSalvas = await salvarPermissoesUsuario(req.params.id, b.permissoes);
      const rows = await query('SELECT * FROM usuarios WHERE id = ? AND empresa_id = ?', [req.params.id, EMPRESA_ID]);
      ok(res, mapUsuarioComPermissoes(rows[0], permissoesSalvas));
    } catch (error) {
      fail(res, error);
    }
  });

  app.put('/api/usuarios/:id/aprovar', async (req, res) => {
    try {
      await ensureAuthTables();
      const b = req.body || {};
      await execute(
        "UPDATE usuarios SET perfil = ?, ativo = 1, status = 'ATIVO' WHERE id = ? AND empresa_id = ?",
        [b.perfil || 'Profissional', req.params.id, EMPRESA_ID]
      );
      const permissoesSalvas = await salvarPermissoesUsuario(req.params.id, b.permissoes);
      const rows = await query('SELECT * FROM usuarios WHERE id = ? AND empresa_id = ?', [req.params.id, EMPRESA_ID]);
      ok(res, mapUsuarioComPermissoes(rows[0], permissoesSalvas));
    } catch (error) {
      fail(res, error);
    }
  });

  app.put('/api/usuarios/:id/rejeitar', async (req, res) => {
    try {
      await ensureAuthTables();
      await execute(
        "UPDATE usuarios SET ativo = 0, status = 'REJEITADO' WHERE id = ? AND empresa_id = ?",
        [req.params.id, EMPRESA_ID]
      );
      await execute('DELETE FROM usuario_permissoes WHERE usuario_id = ?', [req.params.id]);
      ok(res, true);
    } catch (error) {
      fail(res, error);
    }
  });


  // Compatibilidade com versões antigas da tela de usuários pendentes.
  app.post('/api/usuarios-pendentes/:id/autorizar', async (req, res) => {
    try {
      await ensureAuthTables();
      const b = req.body || {};
      await execute(
        "UPDATE usuarios SET perfil = ?, ativo = 1, status = 'ATIVO' WHERE id = ? AND empresa_id = ?",
        [b.perfil || 'Profissional', req.params.id, EMPRESA_ID]
      );
      const permissoesSalvas = await salvarPermissoesUsuario(req.params.id, b.permissoes);
      const rows = await query('SELECT * FROM usuarios WHERE id = ? AND empresa_id = ?', [req.params.id, EMPRESA_ID]);
      ok(res, mapUsuarioComPermissoes(rows[0], permissoesSalvas));
    } catch (error) {
      fail(res, error);
    }
  });

  app.delete('/api/usuarios-pendentes/:id', async (req, res) => {
    try {
      await ensureAuthTables();
      await execute(
        "UPDATE usuarios SET ativo = 0, status = 'REJEITADO' WHERE id = ? AND empresa_id = ?",
        [req.params.id, EMPRESA_ID]
      );
      await execute('DELETE FROM usuario_permissoes WHERE usuario_id = ?', [req.params.id]);
      ok(res, true);
    } catch (error) {
      fail(res, error);
    }
  });

  app.delete('/api/usuarios/:id', async (req, res) => {
    try {
      await ensureAuthTables();
      await execute("UPDATE usuarios SET ativo = 0, status = 'BLOQUEADO' WHERE id = ? AND empresa_id = ?", [
        req.params.id,
        EMPRESA_ID,
      ]);
      ok(res, true);
    } catch (error) {
      fail(res, error);
    }
  });


  // =========================
  // AGENDAMENTO PÚBLICO PARA CLIENTE
  // =========================
  function minutosDaHoraPublica(hora: string) {
    const [h, m] = String(hora || "00:00").slice(0, 5).split(":").map(Number);
    return Number(h || 0) * 60 + Number(m || 0);
  }

  function horaDosMinutosPublica(minutos: number) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function duracaoServicoPublica(duracao: any) {
    const texto = String(duracao || "").toLowerCase();
    const numeros = texto.match(/\d+/g);
    if (!numeros?.length) return 30;
    if (texto.includes("h")) {
      return Math.max(15, Number(numeros[0] || 0) * 60 + Number(numeros[1] || 0));
    }
    return Math.max(15, Number(numeros[0] || 30));
  }

  function dataISOPublica(valor: any) {
    if (!valor) return "";

    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
      const y = valor.getFullYear();
      const m = String(valor.getMonth() + 1).padStart(2, "0");
      const d = String(valor.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    const texto = String(valor).trim();
    if (!texto) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
      const [d, m, y] = texto.split("/");
      return `${y}-${m}-${d}`;
    }

    const data = new Date(texto);
    if (!Number.isNaN(data.getTime())) {
      const y = data.getFullYear();
      const m = String(data.getMonth() + 1).padStart(2, "0");
      const d = String(data.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    return toDateISO(texto);
  }

  async function garantirClientePublico(nome: string, telefone: string) {
    const telefoneLimpo = String(telefone || "").replace(/\D/g, "");
    const existente = telefoneLimpo
      ? await query(
          "SELECT * FROM clientes WHERE empresa_id = ? AND REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', '') = ? LIMIT 1",
          [EMPRESA_ID, telefoneLimpo]
        ).catch(() => [])
      : [];

    if (existente[0]) {
      await execute(
        "UPDATE clientes SET nome = ?, ativo = 1 WHERE id = ? AND empresa_id = ?",
        [nome, existente[0].id, EMPRESA_ID]
      ).catch(() => undefined);
      return existente[0].id;
    }

    const result = await execute(
      "INSERT INTO clientes (empresa_id, nome, telefone, observacao, ativo) VALUES (?, ?, ?, ?, 1)",
      [EMPRESA_ID, nome, telefone, "Cadastro realizado pela página pública de agendamento."]
    );

    return result.insertId;
  }


  async function ensureSolicitacoesAgendamentoTable() {
    await execute(`
      CREATE TABLE IF NOT EXISTS solicitacoes_agendamento (
        id INT AUTO_INCREMENT PRIMARY KEY,
        empresa_id INT NOT NULL DEFAULT 1,
        nome_cliente VARCHAR(150) NOT NULL,
        telefone VARCHAR(40) NOT NULL,
        cliente_id INT NULL,
        profissional_id INT NOT NULL,
        servico_id INT NOT NULL,
        data_agendamento DATE NOT NULL,
        hora_agendamento TIME NOT NULL,
        valor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        observacao TEXT NULL,
        servicos_json TEXT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Solicitado',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => undefined);

    await execute("ALTER TABLE solicitacoes_agendamento ADD COLUMN empresa_id INT NOT NULL DEFAULT 1").catch(() => undefined);
    await execute("ALTER TABLE solicitacoes_agendamento ADD COLUMN cliente_id INT NULL").catch(() => undefined);
    await execute("ALTER TABLE solicitacoes_agendamento ADD COLUMN valor DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
    await execute("ALTER TABLE solicitacoes_agendamento ADD COLUMN observacao TEXT NULL").catch(() => undefined);
    await execute("ALTER TABLE solicitacoes_agendamento ADD COLUMN servicos_json TEXT NULL").catch(() => undefined);
    await execute("ALTER TABLE solicitacoes_agendamento ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'Solicitado'").catch(() => undefined);
  }

  function mapSolicitacaoAgendamento(row: any) {
    return {
      id: String(row.id),
      nomeCliente: row.nome_cliente || "",
      telefone: row.telefone || "",
      clienteId: row.cliente_id ? String(row.cliente_id) : "",
      profissionalId: row.profissional_id ? String(row.profissional_id) : "",
      profissionalNome: row.profissional_nome || "",
      servicoId: row.servico_id ? String(row.servico_id) : "",
      servicoNome: parseServicosJson(row.servicos_json).length ? parseServicosJson(row.servicos_json).map((s: any) => s.nome).join(" + ") : (row.servico_nome || ""),
      servicos: parseServicosJson(row.servicos_json),
      data: row.data_agendamento ? toDateBR(row.data_agendamento) : "",
      dataISO: row.data_agendamento ? dataISOPublica(row.data_agendamento) : "",
      hora: fromTime(row.hora_agendamento),
      valor: Number(row.valor || 0),
      observacao: row.observacao || "",
      status: row.status || "Solicitado",
      criadoEm: row.criado_em ? new Date(row.criado_em).toISOString() : "",
    };
  }

  async function ensureServicosOnlineColumn() {
    await execute("ALTER TABLE servicos ADD COLUMN agendamento_online TINYINT(1) NOT NULL DEFAULT 1").catch(() => undefined);
  }

  function parseServicosIds(valor: any): string[] {
    if (Array.isArray(valor)) {
      return valor.map(String).map((v) => v.trim()).filter(Boolean);
    }

    if (typeof valor === "string") {
      const texto = valor.trim();
      if (!texto) return [];
      try {
        const json = JSON.parse(texto);
        if (Array.isArray(json)) {
          return json.map(String).map((v) => v.trim()).filter(Boolean);
        }
      } catch {}
      return texto.split(",").map((v) => v.trim()).filter(Boolean);
    }

    if (valor) return [String(valor)];
    return [];
  }

  async function obterServicosPorIds(servicosIds: string[], somenteOnline = false) {
    await ensureServicosOnlineColumn();
    const ids = [...new Set(servicosIds.map(String).filter(Boolean))];
    if (!ids.length) return [];

    const onlineSql = somenteOnline ? " AND agendamento_online = 1" : "";
    return await query(
      `SELECT * FROM servicos
       WHERE empresa_id = ?
       AND ativo = 1
       AND id IN (${ids.map(() => "?").join(",")})${onlineSql}`,
      [EMPRESA_ID, ...ids]
    );
  }

  function resumoServicos(servicosLista: any[]) {
    return servicosLista.map((s: any) => ({
      id: String(s.id),
      nome: s.nome || "Serviço",
      valor: Number(s.valor || 0),
      duracao: s.duracao || "",
      duracaoMinutos: duracaoServicoPublica(s.duracao),
    }));
  }

  function parseServicosJson(valor: any) {
    try {
      const lista = valor ? JSON.parse(valor) : [];
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  }

  app.get("/api/publico/agendamento/dados", async (_req, res) => {
    try {
      await ensureServicosOnlineColumn();
      const [empresaRows, servicosRows, profissionaisRows] = await Promise.all([
        query("SELECT nome, marca, telefone, logo_empresa, logo_menu FROM empresas WHERE id = ? LIMIT 1", [EMPRESA_ID]).catch(() => []),
        query("SELECT id, nome, valor, duracao, categoria, comissao, agendamento_online FROM servicos WHERE empresa_id = ? AND ativo = 1 AND agendamento_online = 1 ORDER BY nome", [EMPRESA_ID]),
        query("SELECT id, nome, apelido, usuario_id, funcao, comissao, intervalo_agenda, antecedencia_agendamento, meta_mensal, especialidades FROM profissionais WHERE empresa_id = ? AND ativo = 1 ORDER BY COALESCE(NULLIF(apelido, ''), nome)", [EMPRESA_ID]),
      ]);

      const empresa = empresaRows[0] || {};
      ok(res, {
        empresa: {
          nome: empresa.nome || "",
          marca: empresa.marca || "",
          telefone: empresa.telefone || "",
          logoEmpresa: empresa.logo_empresa || "",
          logoMenu: empresa.logo_menu || empresa.logo_empresa || "",
        },
        servicos: servicosRows.map(mapServico),
        profissionais: await mapProfissionaisComServicos(profissionaisRows),
      });
    } catch (error) {
      fail(res, error);
    }
  });

  app.get("/api/publico/agendamento/horarios", async (req, res) => {
    try {
      const profissionalId = String(req.query.profissionalId || "");
      const servicosIds = parseServicosIds(req.query.servicosIds || req.query.servicoIds || req.query.servicoId);
      const dataISO = dataISOPublica(String(req.query.data || ""));

      if (!profissionalId || !servicosIds.length || !dataISO) {
        ok(res, { horarios: [] });
        return;
      }

      await garantirHorariosProfissional(profissionalId);

      const servicosRows = await obterServicosPorIds(servicosIds, true);
      if (servicosRows.length !== servicosIds.length) throw new Error("Um ou mais serviços não estão disponíveis para agendamento online.");
      if (!(await profissionalExecutaServicos(profissionalId, servicosIds))) {
        throw new Error("Este profissional não executa um ou mais serviços selecionados.");
      }

      const duracao = servicosRows.reduce((total: number, s: any) => total + duracaoServicoPublica(s.duracao), 0) || 30;
      const diaSemana = diaSemanaBR(dataISO);

      const horarioRows = await query(
        `SELECT * FROM horarios_trabalho
         WHERE empresa_id = ? AND profissional_id = ? AND dia_semana = ? LIMIT 1`,
        [EMPRESA_ID, profissionalId, diaSemana]
      );

      const horario = horarioRows[0];
      if (!horario || Number(horario.ativo || 0) !== 1) {
        ok(res, { horarios: [] });
        return;
      }

      const profissionalRows = await query(
        "SELECT intervalo_agenda, antecedencia_agendamento FROM profissionais WHERE empresa_id = ? AND id = ? AND ativo = 1 LIMIT 1",
        [EMPRESA_ID, profissionalId]
      ).catch(() => []);
      const intervaloAgenda = intervaloAgendaValido(profissionalRows[0]?.intervalo_agenda);

      const inicio = minutosDaHoraPublica(fromTime(horario.hora_inicio));
      const fim = minutosDaHoraPublica(fromTime(horario.hora_fim));
      const intervaloInicio = horario.almoco_inicio ? minutosDaHoraPublica(fromTime(horario.almoco_inicio)) : 0;
      const intervaloFim = horario.almoco_fim ? minutosDaHoraPublica(fromTime(horario.almoco_fim)) : 0;

      const ocupadosRows = await query(
        `SELECT a.id, a.hora_agendamento, a.observacao, s.duracao
         FROM agendamentos a
         LEFT JOIN servicos s ON s.id = a.servico_id
         WHERE a.empresa_id = ?
           AND a.profissional_id = ?
           AND a.data_agendamento = ?
           AND a.status <> 'Cancelado'`,
        [EMPRESA_ID, profissionalId, dataISO]
      );

      const solicitacoesPendentesRows = await query(
        `SELECT sa.id, sa.hora_agendamento, sa.servicos_json, s.duracao
         FROM solicitacoes_agendamento sa
         LEFT JOIN servicos s ON s.id = sa.servico_id
         WHERE sa.empresa_id = ?
           AND sa.profissional_id = ?
           AND sa.data_agendamento = ?
           AND sa.status = 'Solicitado'`,
        [EMPRESA_ID, profissionalId, dataISO]
      ).catch(() => []);

      const ocupados = [
        ...ocupadosRows.map((a: any) => {
          const ini = minutosDaHoraPublica(fromTime(a.hora_agendamento));
          const dur = duracaoServicoPublica(a.duracao);
          return { inicio: ini, fim: ini + dur };
        }),
        ...solicitacoesPendentesRows.map((a: any) => {
          const ini = minutosDaHoraPublica(fromTime(a.hora_agendamento));
          const servicosJson = parseServicosJson(a.servicos_json);
          const dur = servicosJson.length
            ? servicosJson.reduce((total: number, s: any) => total + Number(s.duracaoMinutos || duracaoServicoPublica(s.duracao)), 0)
            : duracaoServicoPublica(a.duracao);
          return { inicio: ini, fim: ini + dur };
        }),
      ];

      const horarios = [];
      for (let min = inicio; min + duracao <= fim; min += intervaloAgenda) {
        const final = min + duracao;
        const dentroIntervalo = intervaloInicio && intervaloFim && min < intervaloFim && final > intervaloInicio;
        const conflito = ocupados.some((o: any) => min < o.fim && final > o.inicio);
        horarios.push({
          hora: horaDosMinutosPublica(min),
          disponivel: !dentroIntervalo && !conflito,
        });
      }

      ok(res, { horarios, duracaoTotal: duracao });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post("/api/publico/agendamento/solicitar", async (req, res) => {
    try {
      await ensureSolicitacoesAgendamentoTable();
      await ensureServicosOnlineColumn();
      const b = req.body || {};
      const nome = String(b.nome || "").trim();
      const telefone = String(b.telefone || "").trim();
      const profissionalId = String(b.profissionalId || "");
      const servicosIds = parseServicosIds(b.servicosIds || b.servicoIds || b.servicoId);
      const dataISO = dataISOPublica(b.data);
      const hora = String(b.hora || "").slice(0, 5);

      if (!nome) throw new Error("Informe seu nome.");
      if (!telefone) throw new Error("Informe seu WhatsApp.");
      if (!profissionalId || !servicosIds.length || !dataISO || !hora) throw new Error("Dados do agendamento incompletos.");

      await validarHorarioAgendamento({ profissionalId, data: dataISO, hora });

      const servicosRows = await obterServicosPorIds(servicosIds, true);
      if (servicosRows.length !== servicosIds.length) throw new Error("Um ou mais serviços não estão disponíveis para agendamento online.");
      if (!(await profissionalExecutaServicos(profissionalId, servicosIds))) {
        throw new Error("Este profissional não executa um ou mais serviços selecionados.");
      }

      const profissionalRows = await query(
        "SELECT * FROM profissionais WHERE empresa_id = ? AND id = ? AND ativo = 1 LIMIT 1",
        [EMPRESA_ID, profissionalId]
      );
      const profissional = profissionalRows[0];
      if (!profissional) throw new Error("Profissional não encontrado.");

      const servicosResumo = resumoServicos(servicosRows);
      const valorTotal = servicosResumo.reduce((total: number, s: any) => total + Number(s.valor || 0), 0);
      const duracaoNova = servicosResumo.reduce((total: number, s: any) => total + Number(s.duracaoMinutos || 0), 0) || 30;
      const primeiroServicoId = servicosResumo[0]?.id;
      const inicioNovo = minutosDaHoraPublica(hora);
      const fimNovo = inicioNovo + duracaoNova;

      const conflitos = await query(
        `SELECT a.id, a.hora_agendamento, s.duracao
         FROM agendamentos a
         LEFT JOIN servicos s ON s.id = a.servico_id
         WHERE a.empresa_id = ?
           AND a.profissional_id = ?
           AND a.data_agendamento = ?
           AND a.status <> 'Cancelado'`,
        [EMPRESA_ID, profissionalId, dataISO]
      );

      const temConflitoAgenda = conflitos.some((a: any) => {
        const inicio = minutosDaHoraPublica(fromTime(a.hora_agendamento));
        const fim = inicio + duracaoServicoPublica(a.duracao);
        return inicioNovo < fim && fimNovo > inicio;
      });

      if (temConflitoAgenda) throw new Error("Este horário acabou de ficar indisponível. Escolha outro horário.");

      const pendentes = await query(
        `SELECT sa.id, sa.hora_agendamento, sa.servicos_json, s.duracao
         FROM solicitacoes_agendamento sa
         LEFT JOIN servicos s ON s.id = sa.servico_id
         WHERE sa.empresa_id = ?
           AND sa.profissional_id = ?
           AND sa.data_agendamento = ?
           AND sa.status = 'Solicitado'`,
        [EMPRESA_ID, profissionalId, dataISO]
      ).catch(() => []);

      const temConflitoSolicitacao = pendentes.some((a: any) => {
        const inicio = minutosDaHoraPublica(fromTime(a.hora_agendamento));
        const servicosJson = parseServicosJson(a.servicos_json);
        const dur = servicosJson.length
          ? servicosJson.reduce((total: number, s: any) => total + Number(s.duracaoMinutos || duracaoServicoPublica(s.duracao)), 0)
          : duracaoServicoPublica(a.duracao);
        const fim = inicio + dur;
        return inicioNovo < fim && fimNovo > inicio;
      });

      if (temConflitoSolicitacao) throw new Error("Este horário possui uma solicitação aguardando confirmação. Escolha outro horário.");

      const clienteId = await garantirClientePublico(nome, telefone);
      const observacao = [
        "Solicitação enviada pela página pública de agendamento.",
        `Serviços solicitados: ${servicosResumo.map((s: any) => s.nome).join(" + ")}`,
        `Duração total: ${duracaoNova} minutos`,
      ].join("\n");

      const result = await execute(
        `INSERT INTO solicitacoes_agendamento
         (empresa_id, nome_cliente, telefone, cliente_id, profissional_id, servico_id, data_agendamento, hora_agendamento, valor, observacao, servicos_json, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Solicitado')`,
        [
          EMPRESA_ID,
          nome,
          telefone,
          clienteId,
          profissionalId,
          primeiroServicoId,
          dataISO,
          toTime(hora),
          valorTotal,
          observacao,
          JSON.stringify(servicosResumo),
        ]
      );

      ok(res, { id: String(result.insertId), status: "Solicitado" });
    } catch (error) {
      fail(res, error);
    }
  });

  app.get("/api/solicitacoes-agendamento", async (_req, res) => {
    try {
      await ensureSolicitacoesAgendamentoTable();
      const rows = await query(
        `SELECT sa.*, s.nome AS servico_nome, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome
         FROM solicitacoes_agendamento sa
         LEFT JOIN servicos s ON s.id = sa.servico_id
         LEFT JOIN profissionais p ON p.id = sa.profissional_id
         WHERE sa.empresa_id = ? AND sa.status = 'Solicitado'
         ORDER BY sa.data_agendamento ASC, sa.hora_agendamento ASC, sa.id DESC`,
        [EMPRESA_ID]
      );
      ok(res, rows.map(mapSolicitacaoAgendamento));
    } catch (error) {
      fail(res, error);
    }
  });

  app.put("/api/solicitacoes-agendamento/:id/confirmar", async (req, res) => {
    try {
      await ensureSolicitacoesAgendamentoTable();
      const rows = await query(
        `SELECT sa.*, s.nome AS servico_nome, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome
         FROM solicitacoes_agendamento sa
         LEFT JOIN servicos s ON s.id = sa.servico_id
         LEFT JOIN profissionais p ON p.id = sa.profissional_id
         WHERE sa.empresa_id = ? AND sa.id = ? AND sa.status = 'Solicitado'
         LIMIT 1`,
        [EMPRESA_ID, req.params.id]
      );

      const solicitacao = rows[0];
      if (!solicitacao) throw new Error("Solicitação não encontrada ou já processada.");

      const dataISO = dataISOPublica(solicitacao.data_agendamento);
      const hora = fromTime(solicitacao.hora_agendamento);
      await validarHorarioAgendamento({ profissionalId: solicitacao.profissional_id, data: dataISO, hora });

      const servicosResumo = parseServicosJson(solicitacao.servicos_json);
      const nomesServicos = servicosResumo.length
        ? servicosResumo.map((s: any) => s.nome).join(" + ")
        : (solicitacao.servico_nome || "");

      const clienteId = solicitacao.cliente_id || await garantirClientePublico(solicitacao.nome_cliente, solicitacao.telefone);
      const observacao = [
        "Agendamento criado a partir de solicitação pública.",
        `Solicitação #${solicitacao.id}.`,
        nomesServicos ? `Serviços: ${nomesServicos}` : "",
        solicitacao.observacao || "",
      ].filter(Boolean).join("\n");

      const result = await execute(
        `INSERT INTO agendamentos
         (empresa_id, cliente_id, profissional_id, servico_id, data_agendamento, hora_agendamento, valor, forma_pagamento, status, observacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          EMPRESA_ID,
          clienteId,
          solicitacao.profissional_id,
          solicitacao.servico_id,
          dataISO,
          toTime(hora),
          Number(solicitacao.valor || 0),
          "Pendente",
          "Agendado",
          observacao,
        ]
      );

      await execute(
        "UPDATE solicitacoes_agendamento SET status = 'Confirmado' WHERE id = ? AND empresa_id = ?",
        [req.params.id, EMPRESA_ID]
      );

      const mensagemWhatsApp = [
        `Olá, ${solicitacao.nome_cliente}!`,
        "",
        "✅ Seu agendamento foi confirmado.",
        "",
        `Serviço(s): ${nomesServicos}`,
        `Profissional: ${solicitacao.profissional_nome || ""}`,
        `Data: ${toDateBR(solicitacao.data_agendamento)}`,
        `Horário: ${hora}`,
        "",
        "Aguardamos você. Obrigado pela preferência!",
      ].join("\n");

      ok(res, { agendamentoId: String(result.insertId), telefone: solicitacao.telefone || "", mensagemWhatsApp });
    } catch (error) {
      fail(res, error);
    }
  });

  app.put("/api/solicitacoes-agendamento/:id/recusar", async (req, res) => {
    try {
      await ensureSolicitacoesAgendamentoTable();
      const rows = await query(
        `SELECT sa.*, s.nome AS servico_nome, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome
         FROM solicitacoes_agendamento sa
         LEFT JOIN servicos s ON s.id = sa.servico_id
         LEFT JOIN profissionais p ON p.id = sa.profissional_id
         WHERE sa.empresa_id = ? AND sa.id = ? AND sa.status = 'Solicitado'
         LIMIT 1`,
        [EMPRESA_ID, req.params.id]
      );

      const solicitacao = rows[0];
      if (!solicitacao) throw new Error("Solicitação não encontrada ou já processada.");

      await execute("UPDATE solicitacoes_agendamento SET status = 'Recusado' WHERE id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]);
      const servicosResumo = parseServicosJson(solicitacao.servicos_json);
      const nomesServicos = servicosResumo.length ? servicosResumo.map((s: any) => s.nome).join(" + ") : (solicitacao.servico_nome || "");
      const mensagemWhatsApp = [
        `Olá, ${solicitacao.nome_cliente}!`,
        "",
        "Sua solicitação de agendamento não pôde ser confirmada para este horário.",
        "",
        `Serviço(s): ${nomesServicos}`,
        `Data: ${toDateBR(solicitacao.data_agendamento)}`,
        `Horário: ${fromTime(solicitacao.hora_agendamento)}`,
        "",
        "Por favor, escolha outro horário pela página de agendamento.",
      ].join("\n");

      ok(res, { telefone: solicitacao.telefone || "", mensagemWhatsApp });
    } catch (error) {
      fail(res, error);
    }
  });


  app.post('/api/master/login', async (req, res) => {
    try {
      await ensureMultiEmpresaTables();
      const b = req.body || {};
      const rows = await query(
        'SELECT * FROM administradores_master WHERE email = ? AND senha = ? AND ativo = 1 LIMIT 1',
        [b.email || '', b.senha || '']
      );
      if (!rows[0]) {
        res.status(401).json({ ok: false, error: 'Administrador master inválido.' });
        return;
      }
      ok(res, { id: String(rows[0].id), nome: rows[0].nome, email: rows[0].email, perfil: 'Master' });
    } catch (error) {
      fail(res, error);
    }
  });

  app.get('/api/master/empresas', async (_req, res) => {
    try {
      await ensureMultiEmpresaTables();
      const rows = await query(`
        SELECT e.*,
          (SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id = e.id) AS usuarios_total,
          (SELECT COUNT(*) FROM clientes c WHERE c.empresa_id = e.id) AS clientes_total,
          (SELECT COUNT(*) FROM agendamentos a WHERE a.empresa_id = e.id) AS agendamentos_total
        FROM empresas e
        ORDER BY e.id DESC
      `);
      ok(res, rows.map(mapEmpresaMaster));
    } catch (error) {
      fail(res, error);
    }
  });

  app.post('/api/master/empresas', async (req, res) => {
    try {
      await ensureMultiEmpresaTables();
      await ensureAuthTables();
      const b = req.body || {};
      const nome = String(b.nome || '').trim();
      const slug = String(b.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!nome) throw new Error('Informe o nome da empresa.');
      if (!slug) throw new Error('Informe o slug da empresa.');

      const result = await execute(
        `INSERT INTO empresas
         (nome, marca, slug, email, telefone, plano, ativo, ativa_ate, dias_aviso, bloqueio_motivo, logo_dbo, logo_empresa, logo_menu, fundo_login, cor_primaria)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nome,
          b.marca || nome,
          slug,
          b.email || null,
          b.telefone || null,
          b.plano || 'Teste',
          b.ativo === false ? 0 : 1,
          b.ativaAte || b.ativa_ate || null,
          Number(b.diasAviso || b.dias_aviso || 7),
          b.bloqueioMotivo || b.bloqueio_motivo || null,
          '/logo-dbo.png',
          null,
          null,
          null,
          b.corPrimaria || b.cor_primaria || '#f6b21a',
        ]
      );

      const imagens = await salvarImagensEmpresa(result.insertId, b);
      await execute(
        `UPDATE empresas SET logo_empresa = ?, logo_menu = ?, fundo_login = ? WHERE id = ?`,
        [imagens.logoEmpresa || null, imagens.logoMenu || null, imagens.fundoLogin || null, result.insertId]
      );

      if (b.adminEmail || b.email) {
        await execute(
          `INSERT INTO usuarios (empresa_id, nome, email, senha, perfil, ativo, status)
           VALUES (?, ?, ?, ?, 'Administrador', 1, 'ATIVO')`,
          [result.insertId, b.adminNome || nome, b.adminEmail || b.email || '', b.adminSenha || '130312']
        ).catch(() => undefined);
      }

      const rows = await query('SELECT * FROM empresas WHERE id = ?', [result.insertId]);
      ok(res, mapEmpresaMaster(rows[0]));
    } catch (error) {
      fail(res, error);
    }
  });

  app.put('/api/master/empresas/:id', async (req, res) => {
    try {
      await ensureMultiEmpresaTables();
      const b = req.body || {};
      const nome = String(b.nome || '').trim();
      const slug = String(b.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!nome) throw new Error('Informe o nome da empresa.');
      if (!slug) throw new Error('Informe o slug da empresa.');

      const imagens = await salvarImagensEmpresa(req.params.id, b);

      await execute(
        `UPDATE empresas SET
          nome = ?, marca = ?, slug = ?, email = ?, telefone = ?, plano = ?, ativo = ?, ativa_ate = ?, dias_aviso = ?, bloqueio_motivo = ?,
          logo_empresa = ?, logo_menu = ?, fundo_login = ?, cor_primaria = ?
         WHERE id = ?`,
        [
          nome,
          b.marca || nome,
          slug,
          b.email || null,
          b.telefone || null,
          b.plano || 'Teste',
          b.ativo === false ? 0 : 1,
          b.ativaAte || b.ativa_ate || null,
          Number(b.diasAviso || b.dias_aviso || 7),
          b.bloqueioMotivo || b.bloqueio_motivo || null,
          imagens.logoEmpresa || null,
          imagens.logoMenu || null,
          imagens.fundoLogin || null,
          b.corPrimaria || b.cor_primaria || '#f6b21a',
          req.params.id,
        ]
      );

      const rows = await query('SELECT * FROM empresas WHERE id = ?', [req.params.id]);
      ok(res, mapEmpresaMaster(rows[0]));
    } catch (error) {
      fail(res, error);
    }
  });

  app.put('/api/master/empresas/:id/bloquear', async (req, res) => {
    try {
      await ensureMultiEmpresaTables();
      const motivo = String(req.body?.motivo || req.body?.bloqueioMotivo || 'Bloqueio administrativo.').trim();
      await execute('UPDATE empresas SET ativo = 0, bloqueio_motivo = ? WHERE id = ?', [motivo, req.params.id]);
      const rows = await query('SELECT * FROM empresas WHERE id = ?', [req.params.id]);
      ok(res, mapEmpresaMaster(rows[0]));
    } catch (error) {
      fail(res, error);
    }
  });

  app.put('/api/master/empresas/:id/reativar', async (req, res) => {
    try {
      await ensureMultiEmpresaTables();
      const ativaAte = req.body?.ativaAte || req.body?.ativa_ate || null;
      await execute('UPDATE empresas SET ativo = 1, ativa_ate = COALESCE(?, ativa_ate), bloqueio_motivo = NULL WHERE id = ?', [ativaAte, req.params.id]);
      const rows = await query('SELECT * FROM empresas WHERE id = ?', [req.params.id]);
      ok(res, mapEmpresaMaster(rows[0]));
    } catch (error) {
      fail(res, error);
    }
  });

  app.put('/api/master/empresas/:id/renovar', async (req, res) => {
    try {
      await ensureMultiEmpresaTables();
      const dias = Math.max(1, Number(req.body?.dias || 30));
      const rowsAtual = await query('SELECT ativa_ate FROM empresas WHERE id = ? LIMIT 1', [req.params.id]);
      const atual = dataIsoEmpresa(rowsAtual[0]?.ativa_ate);
      const baseSql = atual && diasRestantesAte(atual) !== null && Number(diasRestantesAte(atual)) >= 0 ? 'ativa_ate' : 'CURDATE()';
      await execute(`UPDATE empresas SET ativo = 1, ativa_ate = DATE_ADD(${baseSql}, INTERVAL ? DAY), bloqueio_motivo = NULL WHERE id = ?`, [dias, req.params.id]);
      const rows = await query('SELECT * FROM empresas WHERE id = ?', [req.params.id]);
      ok(res, mapEmpresaMaster(rows[0]));
    } catch (error) {
      fail(res, error);
    }
  });

  app.delete('/api/master/empresas/:id', async (req, res) => {
    try {
      await ensureMultiEmpresaTables();
      await execute('UPDATE empresas SET ativo = 0, bloqueio_motivo = ? WHERE id = ?', ['Empresa inativada pelo Admin Master.', req.params.id]);
      const rows = await query('SELECT * FROM empresas WHERE id = ?', [req.params.id]);
      ok(res, mapEmpresaMaster(rows[0]));
    } catch (error) {
      fail(res, error);
    }
  });

  app.get('/api/empresa-por-slug/:slug', async (req, res) => {
    try {
      await ensureMultiEmpresaTables();
      const rows = await query('SELECT * FROM empresas WHERE slug = ? LIMIT 1', [String(req.params.slug || '').toLowerCase()]);
      const e = rows[0];
      if (!e) {
        res.status(404).json({ ok: false, error: 'Empresa não encontrada.' });
        return;
      }
      const aviso = avisoEmpresa(e);
      ok(res, {
        id: String(e.id),
        nome: e.nome || '',
        marca: e.marca || e.nome || '',
        slug: e.slug || '',
        email: e.email || '',
        telefone: e.telefone || '',
        logoDbo: e.logo_dbo || '/logo-dbo.png',
        logoEmpresa: e.logo_empresa || '',
        logoMenu: e.logo_menu || e.logo_empresa || '',
        fundoLogin: e.fundo_login || '',
        corPrimaria: e.cor_primaria || '#f6b21a',
        regraComissao: e.regra_comissao || 'bruto',
        plano: e.plano || 'Teste',
        ativo: Boolean(e.ativo),
        ativaAte: dataIsoEmpresa(e.ativa_ate),
        diasAviso: Number(e.dias_aviso || 7),
        avisoVencimento: aviso,
      });
    } catch (error) {
      fail(res, error);
    }
  });

  app.get("/api/health", async (_req, res) => {
    try {
      const rows = await query("SELECT 1 AS conectado");
      ok(res, { banco: "conectado", teste: rows[0] });
    } catch (error) {
      fail(res, error);
    }
  });

  app.get("/api/bootstrap", async (req, res) => {
    try {
      await garantirHorariosTodosProfissionais();
      const usuarioReq = await usuarioDaRequisicao(req);
      const filtrarAgenda = deveFiltrarAgendaPropria(usuarioReq) || deveFiltrarFinanceiroProprio(usuarioReq) || deveFiltrarClientesProprios(usuarioReq);
      const profissionalFiltro = filtrarAgenda ? String(usuarioReq?.profissionalId || '') : '';
      const clientesSql = deveFiltrarClientesProprios(usuarioReq)
        ? `SELECT DISTINCT c.* FROM clientes c
             INNER JOIN agendamentos a ON a.cliente_id = c.id AND a.empresa_id = c.empresa_id
            WHERE c.empresa_id = ? AND c.ativo = 1 AND a.profissional_id = ?
            ORDER BY c.id DESC`
        : "SELECT * FROM clientes WHERE empresa_id = ? AND ativo = 1 ORDER BY id DESC";
      const clientesParams = deveFiltrarClientesProprios(usuarioReq) ? [EMPRESA_ID, profissionalFiltro] : [EMPRESA_ID];

      const [clientes, profissionais, servicos, agendamentos, filaAtendimento, horariosTrabalho] = await Promise.all([
        query(clientesSql, clientesParams),
        query("SELECT * FROM profissionais WHERE empresa_id = ? AND ativo = 1 ORDER BY nome", [EMPRESA_ID]),
        query("SELECT * FROM servicos WHERE empresa_id = ? AND ativo = 1 ORDER BY nome", [EMPRESA_ID]),
        query(`SELECT a.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, s.nome AS servico_nome, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome
               FROM agendamentos a
               LEFT JOIN clientes c ON c.id = a.cliente_id
               LEFT JOIN servicos s ON s.id = a.servico_id
               LEFT JOIN profissionais p ON p.id = a.profissional_id
               WHERE a.empresa_id = ?
                 AND a.status <> 'Solicitado'
                 ${filtrarAgenda ? 'AND a.profissional_id = ?' : ''}
               ORDER BY a.data_agendamento DESC, a.hora_agendamento DESC`, filtrarAgenda ? [EMPRESA_ID, profissionalFiltro] : [EMPRESA_ID]),
        query(`SELECT f.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, s.nome AS servico_nome, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome
               FROM fila_atendimento f
               LEFT JOIN clientes c ON c.id = f.cliente_id
               LEFT JOIN servicos s ON s.id = f.servico_id
               LEFT JOIN profissionais p ON p.id = f.profissional_id
               WHERE f.empresa_id = ?
                 ${filtrarAgenda ? 'AND f.profissional_id = ?' : ''}
               ORDER BY f.id DESC`, filtrarAgenda ? [EMPRESA_ID, profissionalFiltro] : [EMPRESA_ID]),
        query(`SELECT * FROM horarios_trabalho
               WHERE empresa_id = ?
                 ${filtrarAgenda ? 'AND profissional_id = ?' : ''}
               ORDER BY FIELD(dia_semana, 'Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo')`, filtrarAgenda ? [EMPRESA_ID, profissionalFiltro] : [EMPRESA_ID]),
      ]);

      ok(res, {
        clientes: clientes.map(mapCliente),
        profissionais: await mapProfissionaisComServicos(profissionais),
        servicos: servicos.map(mapServico),
        agendamentos: agendamentos.map(mapAgendamento),
        filaAtendimento: filaAtendimento.map(mapFila),
        horariosTrabalho: horariosTrabalho.map(mapHorarioTrabalho),
      });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post("/api/clientes", async (req, res) => {
    try {
      const b = req.body || {};
      const result = await execute(
        "INSERT INTO clientes (empresa_id, nome, telefone, email, observacao) VALUES (?, ?, ?, ?, ?)",
        [EMPRESA_ID, b.nome || "", b.telefone || "", b.email || null, b.observacao || null]
      );
      const rows = await query("SELECT * FROM clientes WHERE id = ?", [result.insertId]);
      ok(res, mapCliente(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.put("/api/clientes/:id", async (req, res) => {
    try {
      const b = req.body || {};
      await execute("UPDATE clientes SET nome = ?, telefone = ?, email = ?, observacao = ? WHERE id = ? AND empresa_id = ?", [b.nome || "", b.telefone || "", b.email || null, b.observacao || null, req.params.id, EMPRESA_ID]);
      const rows = await query("SELECT * FROM clientes WHERE id = ?", [req.params.id]);
      ok(res, mapCliente(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.delete("/api/clientes/:id", async (req, res) => {
    try {
      await execute("DELETE FROM clientes WHERE id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]);
      ok(res, true);
    } catch (error) { fail(res, error); }
  });

  app.post("/api/profissionais", async (req, res) => {
    try {
      await ensureProfissionaisColumns();
      const b = req.body || {};
      const intervaloAgenda = intervaloAgendaValido(b.intervaloAgenda || b.intervalo_agenda);
      const antecedenciaAgendamento = Number(b.antecedenciaAgendamento || b.antecedencia_agendamento || 0);
      const metaMensal = Number(b.metaMensal || b.meta_mensal || 0);
      const especialidades = String(b.especialidades || "");
      const apelido = String(b.apelido || b.nomePublico || "").trim();
      const usuarioId = b.usuarioId || b.usuario_id || null;
      const result = await execute(
        "INSERT INTO profissionais (empresa_id, nome, apelido, usuario_id, funcao, comissao, intervalo_agenda, antecedencia_agendamento, meta_mensal, especialidades) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [EMPRESA_ID, b.nome || "", apelido || null, usuarioId || null, b.funcao || "Profissional", Number(b.comissao || 0), intervaloAgenda, antecedenciaAgendamento, metaMensal, especialidades]
      );
      await salvarServicosDoProfissional(result.insertId, b.servicosIds || b.servicos_ids || []);
      await garantirHorariosProfissional(result.insertId);
      const rows = await query("SELECT * FROM profissionais WHERE id = ? AND empresa_id = ?", [result.insertId, EMPRESA_ID]);
      ok(res, (await mapProfissionaisComServicos(rows))[0]);
    } catch (error) { fail(res, error); }
  });

  app.put("/api/profissionais/:id", async (req, res) => {
    try {
      await ensureProfissionaisColumns();
      const b = req.body || {};
      const intervaloAgenda = intervaloAgendaValido(b.intervaloAgenda || b.intervalo_agenda);
      const antecedenciaAgendamento = Number(b.antecedenciaAgendamento || b.antecedencia_agendamento || 0);
      const metaMensal = Number(b.metaMensal || b.meta_mensal || 0);
      const especialidades = String(b.especialidades || "");
      const apelido = String(b.apelido || b.nomePublico || "").trim();
      const usuarioId = b.usuarioId || b.usuario_id || null;
      await execute(
        "UPDATE profissionais SET nome = ?, apelido = ?, usuario_id = ?, funcao = ?, comissao = ?, intervalo_agenda = ?, antecedencia_agendamento = ?, meta_mensal = ?, especialidades = ? WHERE id = ? AND empresa_id = ?",
        [b.nome || "", apelido || null, usuarioId || null, b.funcao || "Profissional", Number(b.comissao || 0), intervaloAgenda, antecedenciaAgendamento, metaMensal, especialidades, req.params.id, EMPRESA_ID]
      );
      await salvarServicosDoProfissional(req.params.id, b.servicosIds || b.servicos_ids || []);
      await garantirHorariosProfissional(req.params.id);
      const rows = await query("SELECT * FROM profissionais WHERE id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]);
      ok(res, (await mapProfissionaisComServicos(rows))[0]);
    } catch (error) { fail(res, error); }
  });

  app.delete("/api/profissionais/:id", async (req, res) => {
  try {
    const profissional = await query(
      "SELECT id, nome FROM profissionais WHERE id = ? AND empresa_id = ? LIMIT 1",
      [req.params.id, EMPRESA_ID]
    );

    if (!profissional[0]) {
      throw new Error("Profissional não encontrado.");
    }

    await execute(
      "DELETE FROM profissional_servicos WHERE empresa_id = ? AND profissional_id = ?",
      [EMPRESA_ID, req.params.id]
    ).catch(() => undefined);

    await execute(
      "UPDATE profissionais SET ativo = 0 WHERE id = ? AND empresa_id = ?",
      [req.params.id, EMPRESA_ID]
    );

    ok(res, true);
  } catch (error) {
    fail(res, error);
  }
});

  app.post("/api/servicos", async (req, res) => {
    try {
      await ensureServicosOnlineColumn();
      const b = req.body || {};
      const agendamentoOnline = b.agendamentoOnline === false || b.agendamento_online === 0 || b.agendamento_online === false ? 0 : 1;
      const result = await execute(
        "INSERT INTO servicos (empresa_id, nome, valor, duracao, categoria, comissao, agendamento_online) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [EMPRESA_ID, b.nome || "", Number(b.valor || 0), b.duracao || "", b.categoria || null, Number(b.comissao || 0), agendamentoOnline]
      );
      const rows = await query("SELECT * FROM servicos WHERE id = ?", [result.insertId]);
      ok(res, mapServico(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.put("/api/servicos/:id", async (req, res) => {
    try {
      await ensureServicosOnlineColumn();
      const b = req.body || {};
      const agendamentoOnline = b.agendamentoOnline === false || b.agendamento_online === 0 || b.agendamento_online === false ? 0 : 1;
      await execute(
        "UPDATE servicos SET nome = ?, valor = ?, duracao = ?, categoria = ?, comissao = ?, agendamento_online = ? WHERE id = ? AND empresa_id = ?",
        [b.nome || "", Number(b.valor || 0), b.duracao || "", b.categoria || null, Number(b.comissao || 0), agendamentoOnline, req.params.id, EMPRESA_ID]
      );
      const rows = await query("SELECT * FROM servicos WHERE id = ?", [req.params.id]);
      ok(res, mapServico(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.delete("/api/servicos/:id", async (req, res) => {
    try {
      await execute("DELETE FROM servicos WHERE id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]);
      ok(res, true);
    } catch (error) { fail(res, error); }
  });

  app.post("/api/agendamentos", async (req, res) => {
    try {
      const b = req.body || {};
      await validarHorarioAgendamento(b);
      const result = await execute(
        `INSERT INTO agendamentos (empresa_id, cliente_id, profissional_id, servico_id, data_agendamento, hora_agendamento, valor, forma_pagamento, status, observacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [EMPRESA_ID, b.clienteId || null, b.profissionalId || null, b.servicoId || null, toDateISO(b.data), toTime(b.hora), Number(b.valor || 0), b.formaPagamento || "Pix", b.status || "Agendado", b.observacao || null]
      );
      const rows = await query(`SELECT a.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, s.nome AS servico_nome, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome
        FROM agendamentos a LEFT JOIN clientes c ON c.id=a.cliente_id LEFT JOIN servicos s ON s.id=a.servico_id LEFT JOIN profissionais p ON p.id=a.profissional_id WHERE a.id=?`, [result.insertId]);
      ok(res, mapAgendamento(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.put("/api/agendamentos/:id", async (req, res) => {
    try {
      const b = req.body || {};
      await validarHorarioAgendamento(b);
      await execute(
        `UPDATE agendamentos SET cliente_id=?, profissional_id=?, servico_id=?, data_agendamento=?, hora_agendamento=?, valor=?, forma_pagamento=?, status=?, observacao=? WHERE id=? AND empresa_id=?`,
        [b.clienteId || null, b.profissionalId || null, b.servicoId || null, toDateISO(b.data), toTime(b.hora), Number(b.valor || 0), b.formaPagamento || "Pix", b.status || "Agendado", b.observacao || null, req.params.id, EMPRESA_ID]
      );
      const rows = await query(`SELECT a.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, s.nome AS servico_nome, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome
        FROM agendamentos a LEFT JOIN clientes c ON c.id=a.cliente_id LEFT JOIN servicos s ON s.id=a.servico_id LEFT JOIN profissionais p ON p.id=a.profissional_id WHERE a.id=?`, [req.params.id]);
      ok(res, mapAgendamento(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.delete("/api/agendamentos/:id", async (req, res) => {
    try {
      await execute("DELETE FROM agendamentos WHERE id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]);
      ok(res, true);
    } catch (error) { fail(res, error); }
  });

  app.get("/api/fila", async (_req, res) => {
    try {
      const rows = await query(`SELECT f.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, s.nome AS servico_nome, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome
        FROM fila_atendimento f
        LEFT JOIN clientes c ON c.id=f.cliente_id
        LEFT JOIN servicos s ON s.id=f.servico_id
        LEFT JOIN profissionais p ON p.id=f.profissional_id
        WHERE f.empresa_id = ?
        ORDER BY FIELD(f.status, 'Aguardando','Chamado','Em atendimento','Finalizado'), f.id ASC`, [EMPRESA_ID]);
      ok(res, rows.map(mapFila));
    } catch (error) { fail(res, error); }
  });

  app.post("/api/fila", async (req, res) => {
    try {
      const b = req.body || {};
      const clienteId = b.clienteId || b.cliente_id || null;
      const servicoId = b.servicoId || b.servico_id || null;
      const profissionalId = b.profissionalId || b.profissional_id || null;

      if (!clienteId) throw new Error('Cliente obrigatório para entrar na fila.');

      const duplicado = await query(
        `SELECT id FROM fila_atendimento
         WHERE empresa_id = ? AND cliente_id = ? AND status <> 'Finalizado'
         LIMIT 1`,
        [EMPRESA_ID, clienteId]
      );

      if (duplicado[0]) {
        throw new Error('Este cliente já está na fila de atendimento.');
      }

      const result = await execute(
        "INSERT INTO fila_atendimento (empresa_id, cliente_id, servico_id, profissional_id, status, observacao) VALUES (?, ?, ?, ?, 'Aguardando', ?)",
        [EMPRESA_ID, clienteId, servicoId, profissionalId, b.observacao || null]
      );
      const rows = await query(`SELECT f.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, s.nome AS servico_nome, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome
        FROM fila_atendimento f LEFT JOIN clientes c ON c.id=f.cliente_id LEFT JOIN servicos s ON s.id=f.servico_id LEFT JOIN profissionais p ON p.id=f.profissional_id WHERE f.id=?`, [result.insertId]);
      ok(res, mapFila(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.put("/api/fila/:id/status", async (req, res) => {
    try {
      await execute("UPDATE fila_atendimento SET status = ? WHERE id = ? AND empresa_id = ?", [req.body?.status || "Aguardando", req.params.id, EMPRESA_ID]);
      ok(res, true);
    } catch (error) { fail(res, error); }
  });

  app.delete("/api/fila/:id", async (req, res) => {
    try {
      await execute("DELETE FROM fila_atendimento WHERE id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]);
      ok(res, true);
    } catch (error) { fail(res, error); }
  });

  app.get("/api/horarios-trabalho", async (req, res) => {
    try {
      const profissionalId = req.query.profissionalId ? String(req.query.profissionalId) : "";
      const params: any[] = [EMPRESA_ID];
      let where = "WHERE empresa_id = ?";

      if (profissionalId) {
        await garantirHorariosProfissional(profissionalId);
        where += " AND profissional_id = ?";
        params.push(profissionalId);
      } else {
        await garantirHorariosTodosProfissionais();
      }

      const rows = await query(
        `SELECT * FROM horarios_trabalho ${where}
         ORDER BY profissional_id, FIELD(dia_semana, 'Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo')`,
        params
      );

      ok(res, rows.map(mapHorarioTrabalho));
    } catch (error) {
      fail(res, error);
    }
  });

  app.post("/api/horarios-trabalho", async (req, res) => {
    try {
      const b = req.body || {};
      const profissionalId = String(b.profissionalId || "");
      const diaSemana = String(b.diaSemana || "");

      if (!profissionalId || !diaSemana) {
        throw new Error("Profissional e dia da semana são obrigatórios");
      }

      const existente = await query(
        "SELECT id FROM horarios_trabalho WHERE empresa_id = ? AND profissional_id = ? AND dia_semana = ? LIMIT 1",
        [EMPRESA_ID, profissionalId, diaSemana]
      );

      if (existente[0]) {
        await execute(
          `UPDATE horarios_trabalho
           SET ativo = ?, hora_inicio = ?, hora_fim = ?, almoco_inicio = ?, almoco_fim = ?
           WHERE id = ? AND empresa_id = ?`,
          [
            b.ativo ? 1 : 0,
            b.inicio ? toTime(b.inicio) : null,
            b.fim ? toTime(b.fim) : null,
            b.intervaloInicio ? toTime(b.intervaloInicio) : null,
            b.intervaloFim ? toTime(b.intervaloFim) : null,
            existente[0].id,
            EMPRESA_ID,
          ]
        );
      } else {
        await execute(
          `INSERT INTO horarios_trabalho
           (empresa_id, profissional_id, dia_semana, ativo, hora_inicio, hora_fim, almoco_inicio, almoco_fim)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            EMPRESA_ID,
            profissionalId,
            diaSemana,
            b.ativo ? 1 : 0,
            b.inicio ? toTime(b.inicio) : null,
            b.fim ? toTime(b.fim) : null,
            b.intervaloInicio ? toTime(b.intervaloInicio) : null,
            b.intervaloFim ? toTime(b.intervaloFim) : null,
          ]
        );
      }

      const rows = await query(
        "SELECT * FROM horarios_trabalho WHERE empresa_id = ? AND profissional_id = ? AND dia_semana = ? LIMIT 1",
        [EMPRESA_ID, profissionalId, diaSemana]
      );

      ok(res, mapHorarioTrabalho(rows[0]));
    } catch (error) {
      fail(res, error);
    }
  });


  // =========================
  // DESPESAS
  // =========================
  function mapStatusDespesa(status: any) {
    if (status === "Aberto") return "Pendente";
    return status || "Pendente";
  }
  function dbStatusDespesa(status: any) {
    if (status === "Pendente" || status === "Vencido") return "Aberto";
    if (status === "Pago") return "Pago";
    return "Aberto";
  }

  async function ensureFinanceiroColumns() {
    await execute("ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS forma VARCHAR(40) NULL").catch(() => undefined);
    await execute("ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'Pago'").catch(() => undefined);
    await execute("ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS referencia_id VARCHAR(80) NULL").catch(() => undefined);
    await execute("ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS valor_bruto DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
    await execute("ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS taxa_percentual DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
    await execute("ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS valor_taxa DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
    await execute("ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS valor_liquido DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
    await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS forma VARCHAR(40) NULL").catch(() => undefined);
    await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS fornecedor VARCHAR(150) NULL").catch(() => undefined);
    await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente TINYINT(1) NOT NULL DEFAULT 0").catch(() => undefined);
    await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS motivo_estorno TEXT NULL").catch(() => undefined);
    await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_estorno DATE NULL").catch(() => undefined);
  }

  async function criarSaidaFluxoDespesaSePago(despesaId: any, dados: any) {
    const status = dbStatusDespesa(dados.status);
    if (status !== "Pago") return;

    await ensureFinanceiroColumns();

    const existente = await query(
      "SELECT id FROM fluxo_caixa WHERE empresa_id = ? AND tipo = 'Saída' AND origem = ? AND referencia_id = ? LIMIT 1",
      [EMPRESA_ID, dados.categoria || "Despesa", String(despesaId)]
    );

    if (existente[0]) return;

    await execute(
      `INSERT INTO fluxo_caixa
       (empresa_id, tipo, descricao, valor, data_movimento, origem, referencia_id, forma, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        EMPRESA_ID,
        "Saída",
        dados.descricao || "Despesa paga",
        Number(dados.valor || 0),
        toDateISO(dados.dataPagamento || dados.data || new Date().toISOString().slice(0, 10)),
        dados.categoria || "Despesa",
        String(despesaId),
        dados.forma || "Pix",
        "Pago",
      ]
    );
  }

  function mapDespesa(row: any) {
    return {
      id: String(row.id),
      descricao: row.descricao || "",
      categoria: row.categoria || "Outros",
      valor: Number(row.valor || 0),
      data: toDateBR(row.data_vencimento || row.data_pagamento || row.criado_em),
      dataPagamento: row.data_pagamento ? toDateBR(row.data_pagamento) : "",
      lotePagamento: row.lote_pagamento || "",
      forma: row.forma || "Pix",
      fornecedor: row.fornecedor || "",
      status: mapStatusDespesa(row.status),
      observacao: row.observacao || "",
      motivoEstorno: row.motivo_estorno || "",
      dataEstorno: row.data_estorno ? toDateBR(row.data_estorno) : "",
      recorrente: Boolean(row.recorrente),
    };
  }

  app.get("/api/despesas", async (req, res) => {
    try {
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS forma VARCHAR(40) NULL").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS fornecedor VARCHAR(150) NULL").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente TINYINT(1) NOT NULL DEFAULT 0").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS motivo_estorno TEXT NULL").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_estorno DATE NULL").catch(() => undefined);
      const usuarioReq = await usuarioDaRequisicao(req);
      const filtrarFinanceiro = deveFiltrarFinanceiroProprio(usuarioReq);
      const nomeProfissional = String(usuarioReq?.profissionalNome || usuarioReq?.profissionalApelido || '').trim();
      const rows = filtrarFinanceiro
        ? await query(
            `SELECT * FROM despesas
              WHERE empresa_id = ?
                AND categoria = 'Comissão'
                AND (fornecedor = ? OR fornecedor LIKE ?)
              ORDER BY id DESC`,
            [EMPRESA_ID, nomeProfissional, `%${nomeProfissional}%`]
          )
        : await query("SELECT * FROM despesas WHERE empresa_id = ? ORDER BY id DESC", [EMPRESA_ID]);
      ok(res, rows.map(mapDespesa));
    } catch (error) { fail(res, error); }
  });

  app.post("/api/despesas", async (req, res) => {
    try {
      await ensureFinanceiroColumns();
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS lote_pagamento VARCHAR(80) NULL").catch(() => undefined);
      const b = req.body || {};
      const dataPagamento = b.status === "Pago" ? toDateISO(b.dataPagamento || b.data) : null;
      const result = await execute(
        "INSERT INTO despesas (empresa_id, descricao, categoria, valor, data_vencimento, data_pagamento, status, observacao, forma, fornecedor, recorrente) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [EMPRESA_ID, b.descricao || "", b.categoria || "Outros", Number(b.valor || 0), toDateISO(b.data), dataPagamento, dbStatusDespesa(b.status), b.observacao || null, b.forma || null, b.fornecedor || null, b.recorrente ? 1 : 0]
      );

      await criarSaidaFluxoDespesaSePago(result.insertId, { ...b, dataPagamento });

      const rows = await query("SELECT * FROM despesas WHERE id = ?", [result.insertId]);
      ok(res, mapDespesa(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.put("/api/despesas/:id", async (req, res) => {
    try {
      await ensureFinanceiroColumns();
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS lote_pagamento VARCHAR(80) NULL").catch(() => undefined);
      const b = req.body || {};
      const anteriorRows = await query("SELECT * FROM despesas WHERE id = ? AND empresa_id = ? LIMIT 1", [req.params.id, EMPRESA_ID]);
      const anterior = anteriorRows[0];
      const statusNovo = dbStatusDespesa(b.status);
      const dataPagamento = statusNovo === "Pago" ? toDateISO(b.dataPagamento || b.data || new Date().toISOString().slice(0, 10)) : null;

      await execute(
        "UPDATE despesas SET descricao=?, categoria=?, valor=?, data_vencimento=?, data_pagamento=?, status=?, observacao=?, forma=?, fornecedor=?, recorrente=? WHERE id=? AND empresa_id=?",
        [b.descricao || "", b.categoria || "Outros", Number(b.valor || 0), toDateISO(b.data), dataPagamento, statusNovo, b.observacao || null, b.forma || null, b.fornecedor || null, b.recorrente ? 1 : 0, req.params.id, EMPRESA_ID]
      );

      if (!anterior || anterior.status !== "Pago") {
        await criarSaidaFluxoDespesaSePago(req.params.id, { ...b, dataPagamento });
      }

      const rows = await query("SELECT * FROM despesas WHERE id = ?", [req.params.id]);
      ok(res, mapDespesa(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.post("/api/despesas/:id/estornar", async (req, res) => {
    try {
      await ensureFinanceiroColumns();
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS motivo_estorno TEXT NULL").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_estorno DATE NULL").catch(() => undefined);
      const b = req.body || {};
      const motivo = String(b.motivo || b.motivoEstorno || "").trim();
      if (!motivo) throw new Error("Informe o motivo do estorno.");

      const rows = await query("SELECT * FROM despesas WHERE id = ? AND empresa_id = ? LIMIT 1", [req.params.id, EMPRESA_ID]);
      const despesa = rows[0];
      if (!despesa) throw new Error("Despesa não encontrada.");
      if (String(despesa.status || "") !== "Pago") throw new Error("Somente despesas pagas podem ser estornadas.");

      const dataEstorno = toDateISO(b.dataEstorno || new Date().toISOString().slice(0, 10));

      // Estorno de despesa NÃO deve criar nova entrada no fluxo de caixa.
      // A regra correta é apenas marcar a despesa e a saída original como estornadas,
      // para não aparecer como receita nem duplicar movimentação.
      await execute(
        `UPDATE fluxo_caixa
         SET status = 'Estornado',
             descricao = CONCAT(COALESCE(descricao, ''), ?)
         WHERE empresa_id = ?
           AND tipo = 'Saída'
           AND referencia_id = ?`,
        [`\n--- DESPESA ESTORNADA ---\nData: ${dataEstorno}\nMotivo: ${motivo}`, EMPRESA_ID, String(req.params.id)]
      ).catch(() => undefined);

      // Remove movimentações de estorno criadas por versões anteriores da rota.
      await execute(
        `DELETE FROM fluxo_caixa
         WHERE empresa_id = ?
           AND tipo = 'Entrada'
           AND origem = 'Estorno de Despesa'
           AND referencia_id = ?`,
        [EMPRESA_ID, String(req.params.id)]
      ).catch(() => undefined);

      await execute(
        `UPDATE despesas
         SET status = 'Estornado', data_estorno = ?, motivo_estorno = ?, observacao = CONCAT(COALESCE(observacao, ''), ?)
         WHERE id = ? AND empresa_id = ?`,
        [dataEstorno, motivo, `\n--- ESTORNO ---\nData: ${dataEstorno}\nMotivo: ${motivo}`, req.params.id, EMPRESA_ID]
      );

      const atualizada = await query("SELECT * FROM despesas WHERE id = ? AND empresa_id = ? LIMIT 1", [req.params.id, EMPRESA_ID]);
      ok(res, mapDespesa(atualizada[0]));
    } catch (error) { fail(res, error); }
  });

  app.delete("/api/despesas/:id", async (req, res) => {
    try {
      await execute("DELETE FROM despesas WHERE id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]);
      ok(res, true);
    } catch (error) { fail(res, error); }
  });

  // =========================
  // FLUXO DE CAIXA
  // =========================
  function mapFluxo(row: any) {
    return {
      id: String(row.id),
      tipo: row.tipo || "Entrada",
      descricao: row.descricao || "",
      categoria: row.origem || "Manual",
      valor: Number(row.valor || 0),
      valorBruto: Number(row.valor_bruto || row.valor || 0),
      taxaPercentual: Number(row.taxa_percentual || 0),
      valorTaxa: Number(row.valor_taxa || 0),
      valorLiquido: Number(row.valor_liquido || row.valor || 0),
      data: toDateBR(row.data_movimento),
      forma: row.forma || "Pix",
      status: row.status || "Pago",
    };
  }

  app.get("/api/fluxo-caixa", async (req, res) => {
    try {
      await ensureFinanceiroColumns();
      const usuarioReq = await usuarioDaRequisicao(req);
      const filtrarFinanceiro = deveFiltrarFinanceiroProprio(usuarioReq);
      const nomeProfissional = String(usuarioReq?.profissionalNome || usuarioReq?.profissionalApelido || '').trim();
      const rows = filtrarFinanceiro
        ? await query(
            `SELECT * FROM fluxo_caixa
              WHERE empresa_id = ?
                AND (descricao LIKE ? OR origem LIKE ?)
              ORDER BY id DESC`,
            [EMPRESA_ID, `%${nomeProfissional}%`, `%${nomeProfissional}%`]
          )
        : await query("SELECT * FROM fluxo_caixa WHERE empresa_id = ? ORDER BY id DESC", [EMPRESA_ID]);
      ok(res, rows.map(mapFluxo));
    } catch (error) { fail(res, error); }
  });

  app.post("/api/fluxo-caixa", async (req, res) => {
    try {
      await ensureFinanceiroColumns();
      const b = req.body || {};
      const valorBruto = Number(b.valorBruto ?? b.valor ?? 0);
      const taxaPercentual = Number(b.taxaPercentual ?? 0);
      const valorTaxa = Number(b.valorTaxa ?? (valorBruto * taxaPercentual / 100));
      const valorLiquido = Number(b.valorLiquido ?? (valorBruto - valorTaxa));
      const valorLancamento = b.tipo === "Entrada" ? valorLiquido : valorBruto;
      const result = await execute(
        "INSERT INTO fluxo_caixa (empresa_id, tipo, descricao, valor, data_movimento, origem, forma, status, valor_bruto, taxa_percentual, valor_taxa, valor_liquido) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [EMPRESA_ID, b.tipo || "Entrada", b.descricao || "", Number(valorLancamento || 0), toDateISO(b.data), b.categoria || "Manual", b.forma || null, b.status || "Pago", valorBruto, taxaPercentual, valorTaxa, valorLiquido]
      );
      const rows = await query("SELECT * FROM fluxo_caixa WHERE id = ?", [result.insertId]);
      ok(res, mapFluxo(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.delete("/api/fluxo-caixa/:id", async (req, res) => {
    try {
      await execute("DELETE FROM fluxo_caixa WHERE id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]);
      ok(res, true);
    } catch (error) { fail(res, error); }
  });

  // =========================
  // PACOTES E ASSINATURAS V2
  // =========================
  const MARCADOR_SERVICOS_AGENDAMENTO = '[[SERVICOS_AGENDAMENTO_JSON]]';
  const FIM_MARCADOR_SERVICOS_AGENDAMENTO = '[[/SERVICOS_AGENDAMENTO_JSON]]';

  async function ensurePlanosColumns() {
    await execute("ALTER TABLE pacotes ADD COLUMN IF NOT EXISTS itens_json TEXT NULL").catch(() => undefined);
    await execute("ALTER TABLE pacotes ADD COLUMN IF NOT EXISTS valor_original DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
    await execute("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS pago TINYINT(1) NOT NULL DEFAULT 0").catch(() => undefined);
    await execute("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS profissional_id INT NULL").catch(() => undefined);
    await execute("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS servico_id INT NULL").catch(() => undefined);
    await execute("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS dia_semana VARCHAR(20) NULL").catch(() => undefined);
    await execute("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS hora_agendamento TIME NULL").catch(() => undefined);
    await execute("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS gerar_agenda TINYINT(1) NOT NULL DEFAULT 0").catch(() => undefined);
    await execute("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS assinatura_origem_id INT NULL").catch(() => undefined);
    await execute("ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS assinatura_id INT NULL").catch(() => undefined);
    await execute("ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS assinatura_paga TINYINT(1) NOT NULL DEFAULT 0").catch(() => undefined);
    await execute("ALTER TABLE agendamentos MODIFY COLUMN forma_pagamento VARCHAR(40) NOT NULL DEFAULT 'Pix'").catch(() => undefined);

    await execute(`CREATE TABLE IF NOT EXISTS assinatura_saldos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL DEFAULT 1,
      assinatura_id INT NOT NULL,
      servico_id INT NOT NULL,
      quantidade_total INT NOT NULL DEFAULT 0,
      quantidade_utilizada INT NOT NULL DEFAULT 0,
      valor_unitario_original DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      valor_unitario_proporcional DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      valor_total_proporcional DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_assinatura_servico (empresa_id, assinatura_id, servico_id)
    )`).catch(() => undefined);

    await execute(`CREATE TABLE IF NOT EXISTS assinatura_consumos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empresa_id INT NOT NULL DEFAULT 1,
      assinatura_id INT NOT NULL,
      agendamento_id INT NOT NULL,
      servico_id INT NOT NULL,
      quantidade INT NOT NULL DEFAULT 1,
      valor_unitario_proporcional DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_consumo_ass_serv_ag (empresa_id, assinatura_id, agendamento_id, servico_id)
    )`).catch(() => undefined);
  }

  function arred2(v: any) { return Number(Number(v || 0).toFixed(2)); }

  function mapPacote(row: any) {
    let itens: any[] = [];
    try { itens = row.itens_json ? JSON.parse(row.itens_json) : []; } catch { itens = []; }
    return {
      id: String(row.id),
      nome: row.nome || "",
      descricao: row.descricao || "",
      itens,
      valorOriginal: Number(row.valor_original || row.valor || 0),
      valorFinal: Number(row.valor || 0),
      ativo: Boolean(row.ativo),
    };
  }

  function mapAssinatura(row: any) {
    let saldos: any[] = [];
    try { saldos = row.saldos_json ? JSON.parse(row.saldos_json) : []; } catch { saldos = []; }
    return {
      id: String(row.id),
      pacoteId: String(row.pacote_id || ""),
      clienteId: String(row.cliente_id || ""),
      clienteNome: row.cliente_nome || "",
      telefone: row.telefone || "",
      inicio: row.data_inicio ? toDateISO(row.data_inicio) : "",
      vencimento: row.data_fim ? toDateISO(row.data_fim) : "",
      status: row.status === "Vencida" ? "Pendente" : row.status || "Ativa",
      pago: Boolean(row.pago),
      profissionalId: row.profissional_id ? String(row.profissional_id) : "",
      profissionalNome: row.profissional_nome || "",
      servicoId: row.servico_id ? String(row.servico_id) : "",
      servicoNome: row.servico_nome || "",
      diaSemana: row.dia_semana || "",
      hora: row.hora_agendamento ? fromTime(row.hora_agendamento) : "",
      gerarAgenda: Boolean(row.gerar_agenda),
      agendamentosGerados: Number(row.agendamentos_gerados || 0),
      saldos,
    };
  }

  function dataLocalISO(data: Date) {
    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, "0");
    const d = String(data.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function dataSQL(valor: any) {
    if (!valor) return "";
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) return dataLocalISO(valor);
    const texto = String(valor).trim();
    if (!texto) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
      const [d, m, y] = texto.split("/");
      return `${y}-${m}-${d}`;
    }
    const data = new Date(texto);
    if (!Number.isNaN(data.getTime())) return dataLocalISO(data);
    return toDateISO(texto);
  }

  function servicosJsonAgendamento(servicosLista: any[]) {
    return `${MARCADOR_SERVICOS_AGENDAMENTO}${JSON.stringify(servicosLista)}${FIM_MARCADOR_SERVICOS_AGENDAMENTO}`;
  }

  async function itensProporcionaisDoPacote(pacoteId: any) {
    const pacoteRows = await query("SELECT * FROM pacotes WHERE id = ? AND empresa_id = ? LIMIT 1", [pacoteId, EMPRESA_ID]);
    const pacote = pacoteRows[0];
    if (!pacote) throw new Error("Pacote não encontrado.");

    let itens: any[] = [];
    try { itens = pacote.itens_json ? JSON.parse(pacote.itens_json) : []; } catch { itens = []; }
    if (!Array.isArray(itens) || !itens.length) throw new Error("O pacote selecionado não possui serviços.");

    const servicosIds = itens.map((i: any) => i.servicoId || i.servico_id).filter(Boolean);
    const servicosRows = servicosIds.length
      ? await query(`SELECT * FROM servicos WHERE empresa_id = ? AND id IN (${servicosIds.map(() => '?').join(',')})`, [EMPRESA_ID, ...servicosIds])
      : [];

    const totalOriginalCalculado = itens.reduce((total: number, item: any) => {
      const servico = servicosRows.find((s: any) => String(s.id) === String(item.servicoId || item.servico_id));
      return total + Number(servico?.valor || 0) * Math.max(1, Number(item.quantidade || 1));
    }, 0);
    const totalOriginal = Number(pacote.valor_original || totalOriginalCalculado || pacote.valor || 0);
    const valorFinal = Number(pacote.valor || totalOriginal || 0);
    const fator = totalOriginal > 0 ? valorFinal / totalOriginal : 1;

    return itens.map((item: any) => {
      const servico = servicosRows.find((s: any) => String(s.id) === String(item.servicoId || item.servico_id));
      const quantidade = Math.max(1, Number(item.quantidade || 1));
      const valorOriginal = Number(servico?.valor || 0);
      const valorProporcional = arred2(valorOriginal * fator);
      return {
        servicoId: String(item.servicoId || item.servico_id || ''),
        nome: servico?.nome || 'Serviço',
        quantidade,
        valorOriginal,
        valorProporcional,
        valorTotalProporcional: arred2(valorProporcional * quantidade),
        duracaoMinutos: 30,
      };
    }).filter((i: any) => i.servicoId);
  }

  async function criarOuRecriarSaldosAssinatura(assinaturaId: any, pacoteId: any) {
    const existentes = await query('SELECT id FROM assinatura_saldos WHERE empresa_id = ? AND assinatura_id = ? LIMIT 1', [EMPRESA_ID, assinaturaId]).catch(() => []);
    if (existentes[0]) return;

    const itens = await itensProporcionaisDoPacote(pacoteId);
    for (const item of itens) {
      await execute(
        `INSERT INTO assinatura_saldos
         (empresa_id, assinatura_id, servico_id, quantidade_total, quantidade_utilizada, valor_unitario_original, valor_unitario_proporcional, valor_total_proporcional)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
        [EMPRESA_ID, assinaturaId, item.servicoId, item.quantidade, item.valorOriginal, item.valorProporcional, item.valorTotalProporcional]
      );
    }
  }

  async function saldosAssinatura(assinaturaId: any) {
    return await query(
      `SELECT s.*, sv.nome AS servico_nome
       FROM assinatura_saldos s
       LEFT JOIN servicos sv ON sv.id = s.servico_id
       WHERE s.empresa_id = ? AND s.assinatura_id = ?
       ORDER BY sv.nome`,
      [EMPRESA_ID, assinaturaId]
    );
  }

  async function montarSaldosJson(assinaturaId: any) {
    const rows = await saldosAssinatura(assinaturaId);
    return JSON.stringify(rows.map((s: any) => ({
      servicoId: String(s.servico_id),
      servicoNome: s.servico_nome || 'Serviço',
      contratado: Number(s.quantidade_total || 0),
      utilizado: Number(s.quantidade_utilizada || 0),
      saldo: Math.max(0, Number(s.quantidade_total || 0) - Number(s.quantidade_utilizada || 0)),
      valorUnitarioProporcional: Number(s.valor_unitario_proporcional || 0),
    })));
  }

  async function obterPrimeiroServicoDoPacote(pacoteId: any) {
    const itens = await itensProporcionaisDoPacote(pacoteId).catch(() => []);
    return itens?.[0]?.servicoId || null;
  }

  async function gerarOuAtualizarAgendaAssinatura(assinaturaId: any, pago: boolean, formaPagamento: string = "Pix") {
    const rows = await query(`SELECT * FROM assinaturas WHERE id = ? AND empresa_id = ? LIMIT 1`, [assinaturaId, EMPRESA_ID]);
    const a = rows[0];
    if (!a) throw new Error("Assinatura não encontrada para gerar agenda.");

    await criarOuRecriarSaldosAssinatura(assinaturaId, a.pacote_id);

    const deveGerar = Number(a.gerar_agenda || 0) === 1 || Boolean(a.profissional_id && a.dia_semana && a.hora_agendamento);
    if (!deveGerar) return 0;

    const dados = {
      pacote_id: a.pacote_id,
      cliente_id: a.cliente_id,
      profissional_id: a.profissional_id,
      dia_semana: a.dia_semana,
      hora_agendamento: fromTime(a.hora_agendamento),
      data_inicio: dataSQL(a.data_inicio),
      data_fim: dataSQL(a.data_fim),
      forma_pagamento: formaPagamento || "Pix",
      pago,
    };

    const gerados = await gerarAgendamentosDaAssinatura(assinaturaId, dados);

    if (pago) {
      await execute(
        `UPDATE agendamentos
         SET assinatura_paga = 1,
             status = CASE WHEN status = 'Agendado' THEN 'Confirmado' ELSE status END,
             observacao = CASE
               WHEN observacao LIKE '%ASSINATURA PAGA%' THEN observacao
               WHEN observacao LIKE '%ASSINATURA PENDENTE DE PAGAMENTO%' THEN REPLACE(observacao, 'ASSINATURA PENDENTE DE PAGAMENTO', 'ASSINATURA PAGA')
               ELSE CONCAT(COALESCE(observacao, ''), '\nASSINATURA PAGA')
             END
         WHERE empresa_id = ? AND assinatura_id = ?`,
        [EMPRESA_ID, assinaturaId]
      );
    }

    return gerados;
  }

  async function gerarAgendamentosDaAssinatura(assinaturaId: any, b: any) {
    const profissionalId = b.profissionalId || b.profissional_id;
    const clienteId = b.clienteId || b.cliente_id;
    const diaSemana = String(b.diaSemana || b.dia_semana || "");
    const hora = String(b.hora || b.hora_agendamento || "").slice(0, 5);
    const inicioISO = dataSQL(b.inicio || b.data_inicio);
    const fimISO = dataSQL(b.vencimento || b.data_fim);
    if (!profissionalId || !clienteId || !diaSemana || !hora || !inicioISO || !fimISO) return 0;

    const itens = await itensProporcionaisDoPacote(b.pacoteId || b.pacote_id);
    if (!itens.length) throw new Error("O pacote selecionado não possui serviço para gerar a agenda.");

    const maxOcorrencias = Math.max(...itens.map((i: any) => Number(i.quantidade || 1)));
    const inicio = new Date(`${inicioISO}T12:00:00`);
    const fim = new Date(`${fimISO}T12:00:00`);
    const alvo = DIAS_SEMANA_TRABALHO.indexOf(diaSemana);
    if (alvo < 0) throw new Error("Dia da semana inválido para a assinatura.");

    let gerados = 0;
    let ocorrencia = 0;
    const data = new Date(inicio);
    while (data <= fim && ocorrencia < maxOcorrencias) {
      const nomeDia = diaSemanaBR(dataLocalISO(data));
      if (nomeDia === diaSemana) {
        const servicosDaOcorrencia = itens.filter((item: any) => ocorrencia < Number(item.quantidade || 1));
        if (servicosDaOcorrencia.length) {
          const dataAgendamento = dataLocalISO(data);
          const existente = await query(
            `SELECT id FROM agendamentos
             WHERE empresa_id = ? AND profissional_id = ? AND data_agendamento = ? AND hora_agendamento = ? AND status <> 'Cancelado'
             LIMIT 1`,
            [EMPRESA_ID, profissionalId, dataAgendamento, toTime(hora)]
          );

          if (!existente[0]) {
            await validarHorarioAgendamento({ profissionalId, data: dataAgendamento, hora });
            const servicosJson = servicosDaOcorrencia.map((item: any) => ({
              id: item.servicoId,
              nome: item.nome,
              valor: item.valorProporcional,
              duracaoMinutos: item.duracaoMinutos || 30,
              assinatura: true,
            }));
            const primeiro = servicosDaOcorrencia[0];
            const valorTotal = arred2(servicosDaOcorrencia.reduce((s: number, item: any) => s + Number(item.valorProporcional || 0), 0));
            await execute(
              `INSERT INTO agendamentos
               (empresa_id, cliente_id, profissional_id, servico_id, data_agendamento, hora_agendamento, valor, forma_pagamento, status, observacao, assinatura_id, assinatura_paga)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                EMPRESA_ID,
                clienteId,
                profissionalId,
                primeiro.servicoId,
                dataAgendamento,
                toTime(hora),
                valorTotal,
                b.formaPagamento || b.forma_pagamento || "Pix",
                b.pago ? "Confirmado" : "Agendado",
                [
                  `Agendamento gerado automaticamente pela assinatura #${assinaturaId}.`,
                  `Serviços da assinatura: ${servicosDaOcorrencia.map((s: any) => s.nome).join(' + ')}`,
                  b.pago ? "ASSINATURA PAGA" : "ASSINATURA PENDENTE DE PAGAMENTO",
                  servicosJsonAgendamento(servicosJson),
                ].filter(Boolean).join("\n"),
                assinaturaId,
                b.pago ? 1 : 0,
              ]
            );
            gerados += 1;
          }
        }
        ocorrencia += 1;
      }
      data.setDate(data.getDate() + 1);
    }
    return gerados;
  }

  async function consumirSaldoAssinatura(assinaturaId: any, agendamentoId: any, servicosDetalhados: any[]) {
    if (!assinaturaId || !servicosDetalhados.length) return servicosDetalhados;
    await criarOuRecriarSaldosAssinatura(assinaturaId, (await query('SELECT pacote_id FROM assinaturas WHERE id = ? AND empresa_id = ? LIMIT 1', [assinaturaId, EMPRESA_ID]))[0]?.pacote_id);

    const ajustados: any[] = [];
    for (const item of servicosDetalhados) {
      const servicoId = item.id || item.servicoId;
      if (!servicoId) throw new Error(`Serviço sem identificação na assinatura: ${item.nome}`);
      const saldoRows = await query(
        `SELECT * FROM assinatura_saldos WHERE empresa_id = ? AND assinatura_id = ? AND servico_id = ? LIMIT 1`,
        [EMPRESA_ID, assinaturaId, servicoId]
      );
      const saldo = saldoRows[0];
      if (!saldo) throw new Error(`O serviço ${item.nome} não pertence à assinatura.`);
      const quantidade = Math.max(1, Number(item.quantidade || 1));
      const disponivel = Number(saldo.quantidade_total || 0) - Number(saldo.quantidade_utilizada || 0);
      if (disponivel < quantidade) {
        throw new Error(`Saldo insuficiente para ${item.nome}. Disponível: ${disponivel}.`);
      }

      const consumoExistente = await query(
        `SELECT id FROM assinatura_consumos WHERE empresa_id = ? AND assinatura_id = ? AND agendamento_id = ? AND servico_id = ? LIMIT 1`,
        [EMPRESA_ID, assinaturaId, agendamentoId, servicoId]
      );
      if (consumoExistente[0]) {
        throw new Error(`Este atendimento de assinatura já consumiu saldo de ${item.nome}.`);
      }

      await execute(
        `INSERT INTO assinatura_consumos
         (empresa_id, assinatura_id, agendamento_id, servico_id, quantidade, valor_unitario_proporcional)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [EMPRESA_ID, assinaturaId, agendamentoId, servicoId, quantidade, Number(saldo.valor_unitario_proporcional || 0)]
      );
      await execute(
        `UPDATE assinatura_saldos SET quantidade_utilizada = quantidade_utilizada + ?
         WHERE empresa_id = ? AND assinatura_id = ? AND servico_id = ?`,
        [quantidade, EMPRESA_ID, assinaturaId, servicoId]
      );

      ajustados.push({
        ...item,
        valor: Number(saldo.valor_unitario_proporcional || item.valor || 0),
        valorOriginal: Number(saldo.valor_unitario_original || item.valor || 0),
        valorProporcional: Number(saldo.valor_unitario_proporcional || item.valor || 0),
      });
    }
    return ajustados;
  }

  app.get("/api/pacotes", async (_req, res) => {
    try {
      await ensurePlanosColumns();
      const rows = await query("SELECT * FROM pacotes WHERE empresa_id = ? AND ativo = 1 ORDER BY id DESC", [EMPRESA_ID]);
      ok(res, rows.map(mapPacote));
    } catch (error) { fail(res, error); }
  });

  app.post("/api/pacotes", async (req, res) => {
    try {
      await ensurePlanosColumns();
      const b = req.body || {};
      if (!b.nome) throw new Error('Informe o nome do pacote.');
      if (!Array.isArray(b.itens) || !b.itens.length) throw new Error('Adicione pelo menos um serviço ao pacote.');
      if (b.id) {
        await execute("UPDATE pacotes SET nome=?, descricao=?, valor=?, quantidade_servicos=?, itens_json=?, valor_original=? WHERE id=? AND empresa_id=?", [b.nome || "", b.descricao || null, Number(b.valorFinal || 0), Array.isArray(b.itens) ? b.itens.length : 0, JSON.stringify(b.itens || []), Number(b.valorOriginal || 0), b.id, EMPRESA_ID]);
        const rows = await query("SELECT * FROM pacotes WHERE id = ?", [b.id]);
        ok(res, mapPacote(rows[0]));
        return;
      }
      const result = await execute("INSERT INTO pacotes (empresa_id, nome, descricao, valor, quantidade_servicos, itens_json, valor_original) VALUES (?, ?, ?, ?, ?, ?, ?)", [EMPRESA_ID, b.nome || "", b.descricao || null, Number(b.valorFinal || 0), Array.isArray(b.itens) ? b.itens.length : 0, JSON.stringify(b.itens || []), Number(b.valorOriginal || 0)]);
      const rows = await query("SELECT * FROM pacotes WHERE id = ?", [result.insertId]);
      ok(res, mapPacote(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.delete("/api/pacotes/:id", async (req, res) => {
    try {
      await execute("DELETE FROM pacotes WHERE id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]);
      ok(res, true);
    } catch (error) { fail(res, error); }
  });

  app.get("/api/assinaturas", async (_req, res) => {
    try {
      await ensurePlanosColumns();
      const rows = await query(`SELECT a.*, c.nome AS cliente_nome, c.telefone, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome, s.nome AS servico_nome,
               (SELECT COUNT(*) FROM agendamentos ag WHERE ag.assinatura_id = a.id AND ag.empresa_id = a.empresa_id) AS agendamentos_gerados
        FROM assinaturas a
        LEFT JOIN clientes c ON c.id = a.cliente_id
        LEFT JOIN profissionais p ON p.id = a.profissional_id
        LEFT JOIN servicos s ON s.id = a.servico_id
        WHERE a.empresa_id = ? ORDER BY a.id DESC`, [EMPRESA_ID]);
      const saida = [];
      for (const row of rows) {
        await criarOuRecriarSaldosAssinatura(row.id, row.pacote_id).catch(() => undefined);
        saida.push(mapAssinatura({ ...row, saldos_json: await montarSaldosJson(row.id) }));
      }
      ok(res, saida);
    } catch (error) { fail(res, error); }
  });

  app.post("/api/assinaturas", async (req, res) => {
    try {
      await ensurePlanosColumns();
      const b = req.body || {};
      const gerarAgenda = b.gerarAgenda ? 1 : 0;
      const pago = b.pago ? 1 : 0;
      const servicoId = b.servicoId || await obterPrimeiroServicoDoPacote(b.pacoteId);

      if (!b.pacoteId || !b.clienteId) throw new Error("Informe pacote e cliente.");
      if (gerarAgenda && (!b.profissionalId || !b.diaSemana || !b.hora)) {
        throw new Error("Informe profissional, dia da semana e horário para a agenda recorrente.");
      }

      const result = await execute(
        `INSERT INTO assinaturas
         (empresa_id, cliente_id, pacote_id, data_inicio, data_fim, status, pago, profissional_id, servico_id, dia_semana, hora_agendamento, gerar_agenda)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [EMPRESA_ID, b.clienteId, b.pacoteId, dataSQL(b.inicio), dataSQL(b.vencimento), b.status === "Pendente" ? "Vencida" : b.status || "Ativa", pago, b.profissionalId || null, servicoId || null, b.diaSemana || null, b.hora ? toTime(b.hora) : null, gerarAgenda]
      );

      await criarOuRecriarSaldosAssinatura(result.insertId, b.pacoteId);
      const agendamentosGerados = gerarAgenda && pago ? await gerarOuAtualizarAgendaAssinatura(result.insertId, true, b.formaPagamento || "Pix") : 0;

      const rows = await query(`SELECT a.*, c.nome AS cliente_nome, c.telefone, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome, s.nome AS servico_nome,
          ? AS agendamentos_gerados
        FROM assinaturas a
        LEFT JOIN clientes c ON c.id=a.cliente_id
        LEFT JOIN profissionais p ON p.id = a.profissional_id
        LEFT JOIN servicos s ON s.id = a.servico_id
        WHERE a.id=?`, [agendamentosGerados, result.insertId]);
      ok(res, mapAssinatura({ ...rows[0], saldos_json: await montarSaldosJson(result.insertId) }));
    } catch (error) { fail(res, error); }
  });

  app.put("/api/assinaturas/:id", async (req, res) => {
    try {
      await ensurePlanosColumns();
      const b = req.body || {};
      const atualRows = await query("SELECT * FROM assinaturas WHERE id = ? AND empresa_id = ? LIMIT 1", [req.params.id, EMPRESA_ID]);
      const atual = atualRows[0];
      if (!atual) throw new Error("Assinatura não encontrada.");

      const jaPago = Number(atual.pago || 0) === 1;
      const marcarComoPago = Boolean(b.pago) && !jaPago;

      if (jaPago) {
        await execute("UPDATE assinaturas SET status=? WHERE id=? AND empresa_id=?", [b.status === "Pendente" ? "Vencida" : b.status || atual.status || "Ativa", req.params.id, EMPRESA_ID]);
      } else {
        const pacoteId = b.pacoteId || b.pacote_id || atual.pacote_id;
        const clienteId = b.clienteId || b.cliente_id || atual.cliente_id;
        const profissionalId = b.profissionalId || b.profissional_id || atual.profissional_id;
        const servicoId = b.servicoId || b.servico_id || atual.servico_id || await obterPrimeiroServicoDoPacote(pacoteId);
        const diaSemana = b.diaSemana || b.dia_semana || atual.dia_semana;
        const hora = b.hora || b.hora_agendamento || fromTime(atual.hora_agendamento);
        const inicio = dataSQL(b.inicio || b.data_inicio || atual.data_inicio);
        const vencimento = dataSQL(b.vencimento || b.data_fim || atual.data_fim);
        const gerarAgenda = b.gerarAgenda === undefined ? Number(atual.gerar_agenda || 0) : (b.gerarAgenda ? 1 : 0);
        const pago = b.pago ? 1 : 0;

        if (gerarAgenda && (!profissionalId || !diaSemana || !hora)) {
          throw new Error("Informe profissional, dia da semana e horário para a agenda recorrente.");
        }

        await execute(
          `UPDATE assinaturas
           SET cliente_id=?, pacote_id=?, data_inicio=?, data_fim=?, status=?, pago=?, profissional_id=?, servico_id=?, dia_semana=?, hora_agendamento=?, gerar_agenda=?
           WHERE id=? AND empresa_id=?`,
          [clienteId, pacoteId, dataSQL(inicio), dataSQL(vencimento), b.status === "Pendente" ? "Vencida" : b.status || "Ativa", pago, profissionalId || null, servicoId || null, diaSemana || null, hora ? toTime(hora) : null, gerarAgenda, req.params.id, EMPRESA_ID]
        );
        await criarOuRecriarSaldosAssinatura(req.params.id, pacoteId);
        if (marcarComoPago) await gerarOuAtualizarAgendaAssinatura(req.params.id, true, b.formaPagamento || "Pix");
      }

      const rows = await query(`SELECT a.*, c.nome AS cliente_nome, c.telefone, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome, s.nome AS servico_nome,
          (SELECT COUNT(*) FROM agendamentos ag WHERE ag.assinatura_id = a.id AND ag.empresa_id = a.empresa_id) AS agendamentos_gerados
        FROM assinaturas a
        LEFT JOIN clientes c ON c.id=a.cliente_id
        LEFT JOIN profissionais p ON p.id = a.profissional_id
        LEFT JOIN servicos s ON s.id = a.servico_id
        WHERE a.id=?`, [req.params.id]);
      ok(res, mapAssinatura({ ...rows[0], saldos_json: await montarSaldosJson(req.params.id) }));
    } catch (error) { fail(res, error); }
  });

  app.post("/api/assinaturas/:id/receber", async (req, res) => {
    try {
      await ensurePlanosColumns();
      const b = req.body || {};
      const atualRows = await query("SELECT * FROM assinaturas WHERE id = ? AND empresa_id = ? LIMIT 1", [req.params.id, EMPRESA_ID]);
      const atual = atualRows[0];
      if (!atual) throw new Error("Assinatura não encontrada.");
      await criarOuRecriarSaldosAssinatura(req.params.id, atual.pacote_id);
      await execute("UPDATE assinaturas SET pago = 1, status = 'Ativa' WHERE id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]);
      const agendamentosGerados = await gerarOuAtualizarAgendaAssinatura(req.params.id, true, b.formaPagamento || "Pix");
      const rows = await query(`SELECT a.*, c.nome AS cliente_nome, c.telefone, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome, s.nome AS servico_nome,
          (SELECT COUNT(*) FROM agendamentos ag WHERE ag.assinatura_id = a.id AND ag.empresa_id = a.empresa_id) AS agendamentos_gerados
        FROM assinaturas a
        LEFT JOIN clientes c ON c.id=a.cliente_id
        LEFT JOIN profissionais p ON p.id = a.profissional_id
        LEFT JOIN servicos s ON s.id = a.servico_id
        WHERE a.id=?`, [req.params.id]);
      ok(res, { ...mapAssinatura({ ...rows[0], saldos_json: await montarSaldosJson(req.params.id) }), agendamentosGerados });
    } catch (error) { fail(res, error); }
  });

  app.post("/api/assinaturas/:id/renovar", async (req, res) => {
    try {
      await ensurePlanosColumns();
      const b = req.body || {};
      const atualRows = await query("SELECT * FROM assinaturas WHERE id = ? AND empresa_id = ? LIMIT 1", [req.params.id, EMPRESA_ID]);
      const atual = atualRows[0];
      if (!atual) throw new Error("Assinatura não encontrada.");

      const inicioBase = dataSQL(b.inicio) || dataLocalISO(new Date(new Date(dataSQL(atual.data_fim) + 'T12:00:00').getTime() + 24 * 60 * 60 * 1000));
      const inicioDate = new Date(`${inicioBase}T12:00:00`);
      const fimDate = new Date(inicioDate);
      fimDate.setMonth(fimDate.getMonth() + 1);
      fimDate.setDate(fimDate.getDate() - 1);
      const vencimento = dataSQL(b.vencimento) || dataLocalISO(fimDate);
      const pago = b.pago ? 1 : 0;

      const result = await execute(
        `INSERT INTO assinaturas
         (empresa_id, cliente_id, pacote_id, data_inicio, data_fim, status, pago, profissional_id, servico_id, dia_semana, hora_agendamento, gerar_agenda, assinatura_origem_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [EMPRESA_ID, atual.cliente_id, atual.pacote_id, inicioBase, vencimento, pago ? 'Ativa' : 'Vencida', pago, atual.profissional_id || null, atual.servico_id || null, atual.dia_semana || null, atual.hora_agendamento || null, Number(atual.gerar_agenda || 0), req.params.id]
      );
      await criarOuRecriarSaldosAssinatura(result.insertId, atual.pacote_id);
      const agendamentosGerados = pago ? await gerarOuAtualizarAgendaAssinatura(result.insertId, true, b.formaPagamento || "Pix") : 0;
      const rows = await query(`SELECT a.*, c.nome AS cliente_nome, c.telefone, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome, s.nome AS servico_nome,
          ? AS agendamentos_gerados
        FROM assinaturas a
        LEFT JOIN clientes c ON c.id=a.cliente_id
        LEFT JOIN profissionais p ON p.id = a.profissional_id
        LEFT JOIN servicos s ON s.id = a.servico_id
        WHERE a.id=?`, [agendamentosGerados, result.insertId]);
      ok(res, mapAssinatura({ ...rows[0], saldos_json: await montarSaldosJson(result.insertId) }));
    } catch (error) { fail(res, error); }
  });

  app.delete("/api/assinaturas/:id", async (req, res) => {
    try {
      await execute("DELETE FROM assinatura_consumos WHERE assinatura_id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]).catch(() => undefined);
      await execute("DELETE FROM assinatura_saldos WHERE assinatura_id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]).catch(() => undefined);
      await execute("DELETE FROM assinaturas WHERE id = ? AND empresa_id = ?", [req.params.id, EMPRESA_ID]);
      ok(res, true);
    } catch (error) { fail(res, error); }
  });

  // =========================
  // PRODUTOS / ESTOQUE
  // =========================
  function mapProduto(row: any) {
    return {
      id: String(row.id),
      nome: row.nome || '',
      descricao: row.descricao || '',
      categoria: row.categoria || '',
      codigoBarras: row.codigo_barras || '',
      tipoProduto: row.tipo_produto || 'Comercialização',
      estoqueAtual: Number(row.estoque_atual || 0),
      estoqueMinimo: Number(row.estoque_minimo || 0),
      precoCusto: Number(row.preco_custo || 0),
      precoVenda: Number(row.preco_venda || 0),
      ativo: Boolean(row.ativo),
    };
  }

  function mapMovimentoEstoque(row: any) {
    return {
      id: String(row.id),
      produtoId: row.produto_id ? String(row.produto_id) : '',
      produtoNome: row.produto_nome || '',
      tipo: row.tipo || 'entrada',
      quantidade: Number(row.quantidade || 0),
      origem: row.origem || '',
      referenciaId: row.referencia_id ? String(row.referencia_id) : '',
      criadoEm: row.criado_em ? new Date(row.criado_em).toLocaleString('pt-BR') : '',
    };
  }

  app.get('/api/produtos', async (_req, res) => {
    try {
      await execute("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tipo_produto VARCHAR(40) NOT NULL DEFAULT 'Comercialização'").catch(() => undefined);
      const rows = await query('SELECT * FROM produtos WHERE empresa_id = ? AND ativo = 1 ORDER BY nome', [EMPRESA_ID]);
      ok(res, rows.map(mapProduto));
    } catch (error) { fail(res, error); }
  });

  app.post('/api/produtos', async (req, res) => {
    try {
      await execute("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tipo_produto VARCHAR(40) NOT NULL DEFAULT 'Comercialização'").catch(() => undefined);
      const b = req.body || {};
      const result = await execute(
        `INSERT INTO produtos (empresa_id, nome, descricao, categoria, codigo_barras, tipo_produto, estoque_atual, estoque_minimo, preco_custo, preco_venda, ativo)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 1)`,
        [EMPRESA_ID, b.nome || '', b.descricao || null, b.categoria || null, b.codigoBarras || null, b.tipoProduto || 'Comercialização', Number(b.estoqueMinimo || 0), Number(b.precoVenda || 0)]
      );
      const rows = await query('SELECT * FROM produtos WHERE id = ?', [result.insertId]);
      ok(res, mapProduto(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.put('/api/produtos/:id', async (req, res) => {
    try {
      await execute("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tipo_produto VARCHAR(40) NOT NULL DEFAULT 'Comercialização'").catch(() => undefined);
      const b = req.body || {};
      await execute(
        `UPDATE produtos SET nome=?, descricao=?, categoria=?, codigo_barras=?, tipo_produto=?, estoque_atual=?, estoque_minimo=?, preco_custo=?, preco_venda=?, ativo=?
         WHERE id=? AND empresa_id=?`,
        [b.nome || '', b.descricao || null, b.categoria || null, b.codigoBarras || null, b.tipoProduto || 'Comercialização', Number(b.estoqueAtual || 0), Number(b.estoqueMinimo || 0), Number(b.precoCusto || 0), Number(b.precoVenda || 0), b.ativo === false ? 0 : 1, req.params.id, EMPRESA_ID]
      );
      const rows = await query('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
      ok(res, mapProduto(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.delete('/api/produtos/:id', async (req, res) => {
    try {
      await execute('UPDATE produtos SET ativo = 0 WHERE id = ? AND empresa_id = ?', [req.params.id, EMPRESA_ID]);
      ok(res, true);
    } catch (error) { fail(res, error); }
  });

  app.post('/api/produtos/:id/movimentar', async (req, res) => {
    try {
      const b = req.body || {};
      const tipo = b.tipo === 'saida' ? 'saida' : 'entrada';
      const quantidade = Math.abs(Number(b.quantidade || 0));
      if (!quantidade) throw new Error('Quantidade inválida');
      const sinal = tipo === 'saida' ? -1 : 1;
      await execute('UPDATE produtos SET estoque_atual = GREATEST(0, estoque_atual + ?) WHERE id = ? AND empresa_id = ?', [quantidade * sinal, req.params.id, EMPRESA_ID]);
      await execute('INSERT INTO estoque_movimentacoes (empresa_id, produto_id, tipo, quantidade, origem, referencia_id) VALUES (?, ?, ?, ?, ?, ?)', [EMPRESA_ID, req.params.id, tipo, quantidade, b.origem || 'Ajuste manual', req.params.id]);
      const rows = await query('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
      ok(res, mapProduto(rows[0]));
    } catch (error) { fail(res, error); }
  });


  app.post('/api/produtos/registrar-compra', async (req, res) => {
    try {
      await execute("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tipo_produto VARCHAR(40) NOT NULL DEFAULT 'Comercialização'").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS forma VARCHAR(40) NULL").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS fornecedor VARCHAR(150) NULL").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente TINYINT(1) NOT NULL DEFAULT 0").catch(() => undefined);

      const b = req.body || {};
      const produtoId = b.produtoId || b.produto_id;
      const quantidade = Math.abs(Number(b.quantidade || 0));
      const valorUnitario = Number(b.valorUnitario || b.valor_unitario || 0);
      const dataCompra = toDateISO(b.data || new Date().toISOString().slice(0, 10));
      const forma = b.forma || 'Pix';
      const statusDespesa = b.status === 'Pago' ? 'Pago' : 'Aberto';

      if (!produtoId) throw new Error('Produto obrigatório');
      if (!quantidade) throw new Error('Quantidade inválida');
      if (!valorUnitario) throw new Error('Valor unitário inválido');

      const produtoRows = await query('SELECT * FROM produtos WHERE id = ? AND empresa_id = ? AND ativo = 1 LIMIT 1', [produtoId, EMPRESA_ID]);
      const produto = produtoRows[0];
      if (!produto) throw new Error('Produto não encontrado');

      const total = Number((quantidade * valorUnitario).toFixed(2));
      const fornecedor = b.fornecedor || '';
      const origem = `Compra de produto${fornecedor ? ' - ' + fornecedor : ''}`;

      await execute(
        'UPDATE produtos SET estoque_atual = estoque_atual + ?, preco_custo = ?, tipo_produto = COALESCE(tipo_produto, ?) WHERE id = ? AND empresa_id = ?',
        [quantidade, valorUnitario, b.tipoProduto || produto.tipo_produto || 'Comercialização', produtoId, EMPRESA_ID]
      );

      const movResult = await execute(
        'INSERT INTO estoque_movimentacoes (empresa_id, produto_id, tipo, quantidade, origem, referencia_id) VALUES (?, ?, ?, ?, ?, ?)',
        [EMPRESA_ID, produtoId, 'entrada', quantidade, origem, produtoId]
      );

      const descricao = `Compra de ${produto.nome} - ${quantidade} un.`;
      const observacao = [
        b.observacao || '',
        `Entrada automática no estoque. Produto: ${produto.nome}. Quantidade: ${quantidade}. Valor unitário: ${valorUnitario}. Movimentação #${movResult.insertId}.`,
      ].filter(Boolean).join('\n');

      const despesaResult = await execute(
        `INSERT INTO despesas (empresa_id, descricao, categoria, valor, data_vencimento, data_pagamento, status, observacao, forma, fornecedor, recorrente)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [EMPRESA_ID, descricao, 'Produtos', total, dataCompra, statusDespesa === 'Pago' ? dataCompra : null, statusDespesa, observacao, forma, fornecedor || null]
      );

      if (statusDespesa === 'Pago') {
        await ensureFinanceiroColumns();
        await execute(
          `INSERT INTO fluxo_caixa
           (empresa_id, tipo, descricao, valor, data_movimento, origem, referencia_id, forma, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [EMPRESA_ID, 'Saída', descricao, total, dataCompra, 'Produtos', String(despesaResult.insertId), forma, 'Pago']
        );
      }

      const produtoAtualizado = await query('SELECT * FROM produtos WHERE id = ?', [produtoId]);
      ok(res, {
        produto: mapProduto(produtoAtualizado[0]),
        movimentacaoId: String(movResult.insertId),
        despesaId: String(despesaResult.insertId),
        total,
      });
    } catch (error) { fail(res, error); }
  });

  app.get('/api/estoque-movimentacoes', async (_req, res) => {
    try {
      const rows = await query(
        `SELECT m.*, p.nome AS produto_nome
         FROM estoque_movimentacoes m
         LEFT JOIN produtos p ON p.id = m.produto_id
         WHERE m.empresa_id = ?
         ORDER BY m.id DESC`,
        [EMPRESA_ID]
      );
      ok(res, rows.map(mapMovimentoEstoque));
    } catch (error) { fail(res, error); }
  });

  app.post('/api/estoque-movimentacoes', async (req, res) => {
    try {
      const b = req.body || {};
      const produtoId = b.produtoId || b.produto_id;
      const tipo = b.tipo === 'saida' ? 'saida' : 'entrada';
      const quantidade = Math.abs(Number(b.quantidade || 0));

      if (!produtoId) throw new Error('Produto obrigatório');
      if (!quantidade) throw new Error('Quantidade inválida');

      const produtoRows = await query('SELECT * FROM produtos WHERE id = ? AND empresa_id = ? AND ativo = 1 LIMIT 1', [produtoId, EMPRESA_ID]);
      const produto = produtoRows[0];
      if (!produto) throw new Error('Produto não encontrado');

      if (tipo === 'saida' && Number(produto.estoque_atual || 0) < quantidade) {
        throw new Error(`Estoque insuficiente: ${produto.nome}`);
      }

      const sinal = tipo === 'saida' ? -1 : 1;
      await execute('UPDATE produtos SET estoque_atual = estoque_atual + ? WHERE id = ? AND empresa_id = ?', [quantidade * sinal, produtoId, EMPRESA_ID]);

      const result = await execute(
        'INSERT INTO estoque_movimentacoes (empresa_id, produto_id, tipo, quantidade, origem, referencia_id) VALUES (?, ?, ?, ?, ?, ?)',
        [EMPRESA_ID, produtoId, tipo, quantidade, b.origem || 'Ajuste manual', b.referenciaId || produtoId]
      );

      const rows = await query(
        `SELECT m.*, p.nome AS produto_nome
         FROM estoque_movimentacoes m
         LEFT JOIN produtos p ON p.id = m.produto_id
         WHERE m.id = ?`,
        [result.insertId]
      );

      ok(res, mapMovimentoEstoque(rows[0]));
    } catch (error) { fail(res, error); }
  });


  // =========================
  // EMPRESA / FORMAS DE PAGAMENTO
  // =========================
  async function adicionarColunaEmpresaSeNaoExistir(nome: string, definicao: string) {
    const existe = await query('SHOW COLUMNS FROM empresas LIKE ?', [nome]).catch(() => []);
    if (!existe[0]) {
      await execute(`ALTER TABLE empresas ADD COLUMN ${nome} ${definicao}`);
    }
  }

  async function ensureEmpresaColumns() {
    await adicionarColunaEmpresaSeNaoExistir('slug', 'VARCHAR(100) NULL').catch(() => undefined);
    await adicionarColunaEmpresaSeNaoExistir('plano', "VARCHAR(50) NOT NULL DEFAULT 'Teste'").catch(() => undefined);
    await adicionarColunaEmpresaSeNaoExistir('ativo', 'TINYINT(1) NOT NULL DEFAULT 1').catch(() => undefined);
    await adicionarColunaEmpresaSeNaoExistir('endereco', 'VARCHAR(255) NULL').catch(() => undefined);
    await adicionarColunaEmpresaSeNaoExistir('email', 'VARCHAR(150) NULL').catch(() => undefined);
    await adicionarColunaEmpresaSeNaoExistir('observacao', 'TEXT NULL').catch(() => undefined);
    await adicionarColunaEmpresaSeNaoExistir('slogan', 'VARCHAR(255) NULL').catch(() => undefined);
    await adicionarColunaEmpresaSeNaoExistir('logo_dbo', 'LONGTEXT NULL').catch(() => undefined);
    await adicionarColunaEmpresaSeNaoExistir('logo_empresa', 'LONGTEXT NULL').catch(() => undefined);
    await adicionarColunaEmpresaSeNaoExistir('logo_menu', 'LONGTEXT NULL').catch(() => undefined);
    await adicionarColunaEmpresaSeNaoExistir('fundo_login', 'LONGTEXT NULL').catch(() => undefined);
    await adicionarColunaEmpresaSeNaoExistir('regra_comissao', "VARCHAR(30) NOT NULL DEFAULT 'bruto'").catch(() => undefined);
  }

  function mapEmpresa(row: any) {
    return {
      id: String(row.id),
      nome: row.nome || '',
      slug: row.slug || '',
      marca: row.marca || 'DBO',
      documento: row.documento || '',
      cnpj: row.documento || '',
      telefone: row.telefone || '',
      email: row.email || '',
      endereco: row.endereco || '',
      observacao: row.observacao || '',
      slogan: row.slogan || '',
      logoDbo: row.logo_dbo || '',
      logoEmpresa: row.logo_empresa || '',
      logoMenu: row.logo_menu || '',
      fundoLogin: row.fundo_login || '',
      regraComissao: row.regra_comissao || 'bruto',
      comissaoSobre: row.regra_comissao || 'bruto',
      plano: row.plano || 'Teste',
      ativo: row.ativo === undefined ? true : Boolean(row.ativo),
    };
  }

  async function ensureTaxasPagamentoColumns() {
    await execute("ALTER TABLE formas_pagamento ADD COLUMN IF NOT EXISTS taxa_percentual DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
    await execute("ALTER TABLE formas_pagamento ADD COLUMN IF NOT EXISTS observacao TEXT NULL").catch(() => undefined);
    await execute("ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS valor_bruto DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
    await execute("ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS taxa_percentual DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
    await execute("ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS valor_taxa DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
    await execute("ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS valor_liquido DECIMAL(10,2) NOT NULL DEFAULT 0.00").catch(() => undefined);
  }

  function mapFormaPagamento(row: any) {
    return {
      id: String(row.id),
      nome: row.nome || '',
      tipo: row.tipo || 'pix',
      maquinaNome: row.maquina_nome || '',
      maquinaCodigo: row.maquina_codigo || '',
      chavePix: row.maquina_codigo || '',
      observacao: row.observacao || '',
      taxaPercentual: Number(row.taxa_percentual || 0),
      taxa: Number(row.taxa_percentual || 0),
      ativo: Boolean(row.ativo),
    };
  }

  app.get('/api/empresa', async (_req, res) => {
    try {
      await ensureEmpresaColumns();
      const rows = await query('SELECT * FROM empresas WHERE id = ? LIMIT 1', [EMPRESA_ID]);
      ok(res, rows[0] ? mapEmpresa(rows[0]) : null);
    } catch (error) { fail(res, error); }
  });

  app.put('/api/empresa', async (req, res) => {
    try {
      await ensureEmpresaColumns();
      const b = req.body || {};

      const existente = await query('SELECT id FROM empresas WHERE id = ? LIMIT 1', [EMPRESA_ID]);
      if (!existente[0]) {
        await execute(
          `INSERT INTO empresas
           (id, nome, marca, documento, telefone, email, endereco, observacao, slogan, logo_dbo, logo_empresa, logo_menu, fundo_login, regra_comissao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            EMPRESA_ID,
            b.nome || '',
            b.marca || 'DBO',
            b.documento || b.cnpj || null,
            b.telefone || null,
            b.email || null,
            b.endereco || null,
            b.observacao || null,
            b.slogan || null,
            b.logoDbo || null,
            b.logoEmpresa || null,
            b.logoMenu || null,
            b.fundoLogin || null,
            b.regraComissao || b.comissaoSobre || 'bruto',
          ]
        );
      } else {
        await execute(
          `UPDATE empresas
           SET nome=?, marca=?, documento=?, telefone=?, email=?, endereco=?, observacao=?, slogan=?, logo_dbo=?, logo_empresa=?, logo_menu=?, fundo_login=?, regra_comissao=?
           WHERE id=?`,
          [
            b.nome || '',
            b.marca || 'DBO',
            b.documento || b.cnpj || null,
            b.telefone || null,
            b.email || null,
            b.endereco || null,
            b.observacao || null,
            b.slogan || null,
            b.logoDbo || null,
            b.logoEmpresa || null,
            b.logoMenu || null,
            b.fundoLogin || null,
            b.regraComissao || b.comissaoSobre || 'bruto',
            EMPRESA_ID,
          ]
        );
      }

      const rows = await query('SELECT * FROM empresas WHERE id = ? LIMIT 1', [EMPRESA_ID]);
      ok(res, mapEmpresa(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.get('/api/formas-pagamento', async (_req, res) => {
    try {
      await ensureTaxasPagamentoColumns();
      const rows = await query('SELECT * FROM formas_pagamento WHERE empresa_id = ? AND ativo = 1 ORDER BY nome', [EMPRESA_ID]);
      ok(res, rows.map(mapFormaPagamento));
    } catch (error) { fail(res, error); }
  });

  app.post('/api/formas-pagamento', async (req, res) => {
    try {
      await ensureTaxasPagamentoColumns();
      const b = req.body || {};
      const taxa = Number(b.taxaPercentual ?? b.taxa ?? 0);
      const result = await execute('INSERT INTO formas_pagamento (empresa_id, nome, tipo, maquina_nome, maquina_codigo, observacao, taxa_percentual, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)', [EMPRESA_ID, b.nome || '', b.tipo || 'pix', b.maquinaNome || b.tipo || null, b.maquinaCodigo || b.chavePix || null, b.observacao || null, taxa]);
      const rows = await query('SELECT * FROM formas_pagamento WHERE id = ?', [result.insertId]);
      ok(res, mapFormaPagamento(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.put('/api/formas-pagamento/:id', async (req, res) => {
    try {
      await ensureTaxasPagamentoColumns();
      const b = req.body || {};
      const taxa = Number(b.taxaPercentual ?? b.taxa ?? 0);
      await execute('UPDATE formas_pagamento SET nome=?, tipo=?, maquina_nome=?, maquina_codigo=?, observacao=?, taxa_percentual=?, ativo=? WHERE id=? AND empresa_id=?', [b.nome || '', b.tipo || 'pix', b.maquinaNome || b.tipo || null, b.maquinaCodigo || b.chavePix || null, b.observacao || null, taxa, b.ativo === false ? 0 : 1, req.params.id, EMPRESA_ID]);
      const rows = await query('SELECT * FROM formas_pagamento WHERE id = ?', [req.params.id]);
      ok(res, mapFormaPagamento(rows[0]));
    } catch (error) { fail(res, error); }
  });

  app.delete('/api/formas-pagamento/:id', async (req, res) => {
    try {
      await execute('UPDATE formas_pagamento SET ativo = 0 WHERE id = ? AND empresa_id = ?', [req.params.id, EMPRESA_ID]);
      ok(res, true);
    } catch (error) { fail(res, error); }
  });

  // =========================
  // FECHAMENTO DO ATENDIMENTO / COMISSÕES
  // =========================
  app.post('/api/agendamentos/:id/finalizar', async (req, res) => {
    try {
      const b = req.body || {};
      const agRows = await query(
        `SELECT a.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome, p.comissao
         FROM agendamentos a
         LEFT JOIN clientes c ON c.id = a.cliente_id
         LEFT JOIN profissionais p ON p.id = a.profissional_id
         WHERE a.id = ? AND a.empresa_id = ? LIMIT 1`,
        [req.params.id, EMPRESA_ID]
      );

      const ag = agRows[0];
      if (!ag) throw new Error('Agendamento não encontrado');

      const servicosRecebidos = Array.isArray(b.servicos) ? b.servicos : [];
      const produtosRecebidos = Array.isArray(b.produtos) ? b.produtos : [];

      let servicosDetalhados: any[] = [];
      let totalServicos = 0;

      for (const item of servicosRecebidos) {
        const nome = String(item.nome || '').trim();
        const quantidade = Math.max(1, Number(item.quantidade || 1));
        const valor = Number(item.valor || 0);
        if (!nome || valor <= 0) continue;

        servicosDetalhados.push({
          id: item.id || null,
          nome,
          quantidade,
          valor,
        });
        totalServicos += valor * quantidade;
      }

      if (servicosDetalhados.length === 0) {
        const servicoRows = await query('SELECT * FROM servicos WHERE id = ? AND empresa_id = ? LIMIT 1', [ag.servico_id, EMPRESA_ID]);
        const servico = servicoRows[0];
        const valor = Number(ag.valor || servico?.valor || 0);
        servicosDetalhados.push({
          id: ag.servico_id || null,
          nome: servico?.nome || 'Serviço',
          quantidade: 1,
          valor,
        });
        totalServicos = valor;
      }

      const atendimentoAssinaturaPaga = Boolean(ag.assinatura_id) && (
        Number(ag.assinatura_paga || 0) === 1 ||
        String(ag.observacao || '').toUpperCase().includes('ASSINATURA PAGA')
      );

      if (atendimentoAssinaturaPaga) {
        await ensurePlanosColumns();
        servicosDetalhados = await consumirSaldoAssinatura(ag.assinatura_id, req.params.id, servicosDetalhados);
        totalServicos = servicosDetalhados.reduce((s, item) => s + Number(item.valor || 0) * Number(item.quantidade || 1), 0);
      }

      const produtosDetalhados: any[] = [];
      let totalProdutos = 0;

      for (const item of produtosRecebidos) {
        const produtoId = item.id || item.produtoId;
        const quantidade = Math.abs(Number(item.quantidade || 0));
        if (!produtoId || !quantidade) continue;

        const produtoRows = await query(
          'SELECT * FROM produtos WHERE id = ? AND empresa_id = ? AND ativo = 1 LIMIT 1',
          [produtoId, EMPRESA_ID]
        );

        const produto = produtoRows[0];
        if (!produto) throw new Error('Produto não encontrado');

        if (Number(produto.estoque_atual || 0) < quantidade) {
          throw new Error(`Estoque insuficiente: ${produto.nome}`);
        }

        const valor = Number(item.valor || produto.preco_venda || 0);
        produtosDetalhados.push({ produto, quantidade, valor });
        totalProdutos += valor * quantidade;
      }

      const subtotalAtendimento = totalServicos + totalProdutos;
      const descontoSolicitado = Math.max(0, Number(b.descontoValor || 0));
      const valorDesconto = Number(Math.min(subtotalAtendimento, descontoSolicitado).toFixed(2));
      const descontoMotivo = String(b.descontoMotivo || '').trim();

      if (valorDesconto > 0 && subtotalAtendimento > 0) {
        const proporcaoServicos = totalServicos / subtotalAtendimento;
        const descontoServicos = Number((valorDesconto * proporcaoServicos).toFixed(2));
        const descontoProdutos = Number((valorDesconto - descontoServicos).toFixed(2));
        totalServicos = Number(Math.max(0, totalServicos - descontoServicos).toFixed(2));
        totalProdutos = Number(Math.max(0, totalProdutos - descontoProdutos).toFixed(2));
      }

      const valorTotal = Number((totalServicos + totalProdutos).toFixed(2));
      if (valorTotal <= 0) throw new Error('Valor total inválido');

      const dataHoje = new Date().toISOString().slice(0, 10);
      // Mesmo em atendimento de assinatura paga, mantém uma forma válida da coluna
      // forma_pagamento. A receita da assinatura não é lançada novamente no caixa.
      const formaPagamento = b.formaPagamento || ag.forma_pagamento || 'Pix';

      await ensureTaxasPagamentoColumns();
      const formaRows = await query(
        'SELECT id, taxa_percentual FROM formas_pagamento WHERE empresa_id = ? AND nome = ? AND ativo = 1 LIMIT 1',
        [EMPRESA_ID, formaPagamento]
      );
      const formaPagamentoId = formaRows[0]?.id || null;
      // Usa a taxa cadastrada na forma de pagamento. Se por algum motivo a forma ainda não estiver no banco,
      // usa a taxa enviada pelo modal como fallback para não perder a taxa do cartão.
      const taxaPercentualBanco = Number(formaRows[0]?.taxa_percentual || 0);
      const taxaPercentualBody = Number(b.taxaPercentual ?? b.taxa ?? 0);
      const taxaPercentual = taxaPercentualBanco > 0 ? taxaPercentualBanco : taxaPercentualBody;
      const valorTaxaServicos = Number((!atendimentoAssinaturaPaga ? totalServicos : 0) * taxaPercentual / 100);
      const valorTaxaProdutos = Number(totalProdutos * taxaPercentual / 100);
      const valorTaxaTotal = Number((valorTaxaServicos + valorTaxaProdutos).toFixed(2));
      const valorLiquidoServicos = Number(((!atendimentoAssinaturaPaga ? totalServicos : 0) - valorTaxaServicos).toFixed(2));
      const valorLiquidoProdutos = Number((totalProdutos - valorTaxaProdutos).toFixed(2));
      const valorLiquidoTotal = Number((valorLiquidoServicos + valorLiquidoProdutos).toFixed(2));

      await ensureEmpresaColumns();
      const empresaConfigRows = await query('SELECT regra_comissao FROM empresas WHERE id = ? LIMIT 1', [EMPRESA_ID]).catch(() => []);
      const modoComissaoCartao = String(empresaConfigRows[0]?.regra_comissao || 'bruto');

      const comandaResult = await execute(
        `INSERT INTO comandas (empresa_id, agendamento_id, cliente_nome, profissional_nome, valor_total, forma_pagamento_id, status, finalizado_em)
         VALUES (?, ?, ?, ?, ?, ?, 'finalizada', NOW())`,
        [EMPRESA_ID, req.params.id, ag.cliente_nome || '', ag.profissional_nome || '', valorTotal, formaPagamentoId]
      );

      for (const item of servicosDetalhados) {
        await execute(
          'INSERT INTO comanda_itens (comanda_id, tipo, item_id, nome, quantidade, valor) VALUES (?, ?, ?, ?, ?, ?)',
          [comandaResult.insertId, 'servico', item.id, item.nome, item.quantidade, item.valor]
        );
      }

      for (const item of produtosDetalhados) {
        await execute(
          'INSERT INTO comanda_itens (comanda_id, tipo, item_id, nome, quantidade, valor) VALUES (?, ?, ?, ?, ?, ?)',
          [comandaResult.insertId, 'produto', item.produto.id, item.produto.nome, item.quantidade, item.valor]
        );

        await execute(
          'UPDATE produtos SET estoque_atual = estoque_atual - ? WHERE id = ? AND empresa_id = ?',
          [item.quantidade, item.produto.id, EMPRESA_ID]
        );

        await execute(
          'INSERT INTO estoque_movimentacoes (empresa_id, produto_id, tipo, quantidade, origem, referencia_id) VALUES (?, ?, ?, ?, ?, ?)',
          [EMPRESA_ID, item.produto.id, 'saida', item.quantidade, 'Venda em atendimento', comandaResult.insertId]
        );
      }

      const nomesServicos = servicosDetalhados.map((s) => s.nome).join(' + ');
      await execute(
        'UPDATE agendamentos SET status = ?, forma_pagamento = ?, valor = ?, observacao = CONCAT(COALESCE(observacao, ""), ?) WHERE id = ? AND empresa_id = ?',
        [
          'Realizado',
          formaPagamento,
          valorTotal,
          `\n--- FECHAMENTO ---\nServiços: ${nomesServicos}\nProdutos: ${produtosDetalhados.map((p) => `${p.quantidade}x ${p.produto.nome}`).join(', ') || 'Nenhum'}\nSubtotal: ${subtotalAtendimento.toFixed(2)}\nDesconto: ${valorDesconto.toFixed(2)}${descontoMotivo ? ` (${descontoMotivo})` : ''}\nTotal recebido: ${valorTotal.toFixed(2)}\nForma: ${formaPagamento}`,
          req.params.id,
          EMPRESA_ID,
        ]
      );

      // Se o atendimento veio de uma assinatura já paga, não lança nova entrada
      // dos serviços no fluxo de caixa, para evitar duplicidade de receita.
      // A comissão continua sendo gerada somente aqui, quando o atendimento é realizado.
      if (totalServicos > 0 && !atendimentoAssinaturaPaga) {
        await execute(
          'INSERT INTO fluxo_caixa (empresa_id, tipo, descricao, valor, data_movimento, origem, referencia_id, forma, status, valor_bruto, taxa_percentual, valor_taxa, valor_liquido) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            EMPRESA_ID,
            'Entrada',
            `${ag.cliente_nome || 'Cliente'} - ${nomesServicos}`,
            valorLiquidoServicos,
            dataHoje,
            'Atendimento',
            comandaResult.insertId,
            formaPagamento,
            'Pago',
            totalServicos,
            taxaPercentual,
            valorTaxaServicos,
            valorLiquidoServicos,
          ]
        );
      }

      if (totalProdutos > 0) {
        const nomesProdutos = produtosDetalhados.map((p) => `${p.quantidade}x ${p.produto.nome}`).join(', ');
        await execute(
          'INSERT INTO fluxo_caixa (empresa_id, tipo, descricao, valor, data_movimento, origem, referencia_id, forma, status, valor_bruto, taxa_percentual, valor_taxa, valor_liquido) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            EMPRESA_ID,
            'Entrada',
            `${ag.cliente_nome || 'Cliente'} - Produtos: ${nomesProdutos}`,
            valorLiquidoProdutos,
            dataHoje,
            'Produtos',
            comandaResult.insertId,
            formaPagamento,
            'Pago',
            totalProdutos,
            taxaPercentual,
            valorTaxaProdutos,
            valorLiquidoProdutos,
          ]
        );
      }

      // Taxa de cartão automática: quando houver taxa, gera uma despesa financeira PAGA.
      // O fluxo de caixa já recebe o valor líquido e guarda bruto/taxa/líquido; esta despesa permite aparecer em Despesas, Financeiro e DRE.
      if (valorTaxaTotal > 0) {
        await ensureFinanceiroColumns();
        await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS forma VARCHAR(40) NULL").catch(() => undefined);
        await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS fornecedor VARCHAR(150) NULL").catch(() => undefined);
        await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente TINYINT(1) NOT NULL DEFAULT 0").catch(() => undefined);

        const jaExisteTaxa = await query(
          "SELECT id FROM despesas WHERE empresa_id = ? AND categoria = 'Taxas de Cartão' AND observacao LIKE ? LIMIT 1",
          [EMPRESA_ID, `%Comanda #${comandaResult.insertId}.%`]
        );

        if (!jaExisteTaxa[0]) {
          const descricaoTaxa = `Taxa de cartão - ${formaPagamento} - ${ag.cliente_nome || 'Cliente'}`;
          const observacaoTaxa = [
            'Taxa gerada automaticamente pelo recebimento do atendimento.',
            `Agendamento #${req.params.id}.`,
            `Comanda #${comandaResult.insertId}.`,
            `Forma: ${formaPagamento}.`,
            `Taxa: ${taxaPercentual.toFixed(2)}%.`,
            `Valor bruto: ${valorTotal.toFixed(2)}.`,
            `Valor da taxa: ${valorTaxaTotal.toFixed(2)}.`,
            `Valor líquido: ${valorLiquidoTotal.toFixed(2)}.`,
          ].join(' ');

          await execute(
            `INSERT INTO despesas (empresa_id, descricao, categoria, valor, data_vencimento, data_pagamento, status, observacao, forma, fornecedor, recorrente)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              EMPRESA_ID,
              descricaoTaxa,
              'Taxas de Cartão',
              valorTaxaTotal,
              dataHoje,
              dataHoje,
              'Pago',
              observacaoTaxa,
              formaPagamento,
              'Operadora de Cartão',
            ]
          );
        }
      }

      // Comissão automática: cria uma despesa PENDENTE somente sobre serviços.
      // Regra:
      // 1) Usa a comissão do profissional, se estiver cadastrada.
      // 2) Se a comissão do profissional estiver 0/vazia, usa a comissão cadastrada no serviço, quando existir.
      // 3) Produtos não geram comissão.
      let percentualComissaoProfissional = Number(ag.comissao || 0);
      let valorComissao = 0;
      let detalheCalculoComissao = '';

      if (percentualComissaoProfissional > 0) {
        let baseComissao = totalServicos;

        if (!atendimentoAssinaturaPaga && taxaPercentual > 0) {
          if (modoComissaoCartao === 'liquido') {
            baseComissao = valorLiquidoServicos;
          } else if (modoComissaoCartao === 'dividir_taxa' || modoComissaoCartao === 'dividir') {
            baseComissao = totalServicos - (valorTaxaServicos / 2);
          } else {
            baseComissao = totalServicos;
          }
        }

        baseComissao = Math.max(0, Number(baseComissao.toFixed(2)));
        valorComissao = baseComissao * (percentualComissaoProfissional / 100);

        if (modoComissaoCartao === 'liquido') {
          detalheCalculoComissao = `${percentualComissaoProfissional}% sobre valor líquido dos serviços (${baseComissao.toFixed(2)})`;
        } else if (modoComissaoCartao === 'dividir_taxa' || modoComissaoCartao === 'dividir') {
          detalheCalculoComissao = `${percentualComissaoProfissional}% sobre serviços menos metade da taxa (${baseComissao.toFixed(2)})`;
        } else {
          detalheCalculoComissao = `${percentualComissaoProfissional}% sobre valor bruto dos serviços (${baseComissao.toFixed(2)})`;
        }
      } else {
        // Se o profissional estiver com comissão 0%, não gera comissão automática,
        // mesmo que algum serviço tenha comissão configurada.
        valorComissao = 0;
        detalheCalculoComissao = 'profissional com comissão 0%';
      }

      valorComissao = Number(valorComissao.toFixed(2));

      if (valorComissao > 0) {
        await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS forma VARCHAR(40) NULL").catch(() => undefined);
        await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS fornecedor VARCHAR(150) NULL").catch(() => undefined);
        await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente TINYINT(1) NOT NULL DEFAULT 0").catch(() => undefined);
        const descricaoComissao = `Comissão - ${ag.profissional_nome || 'Profissional'} - ${nomesServicos}`;
        const observacaoComissao = [
          'Comissão gerada automaticamente pelo atendimento realizado.',
          atendimentoAssinaturaPaga ? 'Origem: atendimento de assinatura paga.' : 'Origem: atendimento avulso.',
          `Cliente: ${ag.cliente_nome || 'Cliente'}.`,
          `Serviços: ${nomesServicos}.`,
          `Agendamento #${req.params.id}.`,
          `Comanda #${comandaResult.insertId}.`,
          `Cálculo: ${detalheCalculoComissao || 'não informado'}.`,
        ].join(' ');

        // Proteção contra comissão duplicada: a comissão é gerada uma única vez
        // por agendamento, inclusive quando for atendimento oriundo de assinatura.
        const jaExiste = await query(
          "SELECT id FROM despesas WHERE empresa_id = ? AND categoria = 'Comissão' AND observacao LIKE ? LIMIT 1",
          [EMPRESA_ID, `%Agendamento #${req.params.id}.%`]
        );

        if (!jaExiste[0]) {
          await execute(
            `INSERT INTO despesas (empresa_id, descricao, categoria, valor, data_vencimento, status, observacao, forma, fornecedor, recorrente)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              EMPRESA_ID,
              descricaoComissao,
              'Comissão',
              valorComissao,
              dataHoje,
              'Aberto',
              observacaoComissao,
              formaPagamento,
              ag.profissional_nome || 'Profissional',
            ]
          );
        }
      }

      ok(res, {
        comandaId: String(comandaResult.insertId),
        valorTotal,
        taxaPercentual,
        valorTaxa: valorTaxaTotal,
        valorLiquido: valorLiquidoTotal,
        modoComissaoCartao,
        taxaDespesaGerada: valorTaxaTotal > 0,
        totalServicos,
        totalProdutos,
        valorComissao,
        comissaoGerada: valorComissao > 0,
        atendimentoAssinaturaPaga,
        avisoComissao: valorComissao > 0
          ? (atendimentoAssinaturaPaga
              ? 'Comissão de assinatura gerada somente após atendimento realizado.'
              : 'Comissão enviada para Despesas como pendente.')
          : 'Comissão não gerada porque o profissional/serviço está com comissão 0%.',
      });
    } catch (error) { fail(res, error); }
  });

  app.post('/api/agendamentos/:id/estornar', async (req, res) => {
    try {
      await ensureFinanceiroColumns();
      const b = req.body || {};
      const motivo = String(b.motivo || '').trim();
      if (!motivo) throw new Error('Informe o motivo do estorno.');

      const agRows = await query(
        `SELECT a.*, c.nome AS cliente_nome, COALESCE(NULLIF(p.apelido, ''), p.nome) AS profissional_nome
         FROM agendamentos a
         LEFT JOIN clientes c ON c.id = a.cliente_id
         LEFT JOIN profissionais p ON p.id = a.profissional_id
         WHERE a.id = ? AND a.empresa_id = ? LIMIT 1`,
        [req.params.id, EMPRESA_ID]
      );
      const ag = agRows[0];
      if (!ag) throw new Error('Agendamento não encontrado.');

      const comandaRows = await query(
        "SELECT * FROM comandas WHERE empresa_id = ? AND agendamento_id = ? ORDER BY id DESC LIMIT 1",
        [EMPRESA_ID, req.params.id]
      ).catch(() => []);
      const comanda = comandaRows[0];

      const dataHoje = new Date().toISOString().slice(0, 10);
      let totalEstorno = Number(ag.valor || 0);
      let formaPagamento = ag.forma_pagamento || 'Pix';

      if (comanda?.id) {
        const entradas = await query(
          "SELECT * FROM fluxo_caixa WHERE empresa_id = ? AND tipo = 'Entrada' AND referencia_id = ? AND status = 'Pago'",
          [EMPRESA_ID, String(comanda.id)]
        ).catch(() => []);

        if (entradas.length) {
          totalEstorno = entradas.reduce((s: number, m: any) => s + Number(m.valor_liquido || m.valor || 0), 0);
          formaPagamento = entradas[0].forma || formaPagamento;
        }

        const jaEstornado = await query(
          "SELECT id FROM fluxo_caixa WHERE empresa_id = ? AND tipo = 'Saída' AND origem = 'Estorno' AND referencia_id = ? LIMIT 1",
          [EMPRESA_ID, String(comanda.id)]
        ).catch(() => []);

        if (!jaEstornado[0] && totalEstorno > 0) {
          await execute(
            'INSERT INTO fluxo_caixa (empresa_id, tipo, descricao, valor, data_movimento, origem, referencia_id, forma, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              EMPRESA_ID,
              'Saída',
              `Estorno pagamento - ${ag.cliente_nome || 'Cliente'}`,
              totalEstorno,
              dataHoje,
              'Estorno',
              String(comanda.id),
              formaPagamento,
              'Pago',
            ]
          );
        }

        const itensProdutos = await query(
          "SELECT * FROM comanda_itens WHERE comanda_id = ? AND tipo = 'produto'",
          [comanda.id]
        ).catch(() => []);

        for (const item of itensProdutos) {
          if (!item.item_id || !Number(item.quantidade || 0)) continue;
          await execute(
            'UPDATE produtos SET estoque_atual = estoque_atual + ? WHERE id = ? AND empresa_id = ?',
            [Number(item.quantidade || 0), item.item_id, EMPRESA_ID]
          ).catch(() => undefined);
          await execute(
            'INSERT INTO estoque_movimentacoes (empresa_id, produto_id, tipo, quantidade, origem, referencia_id) VALUES (?, ?, ?, ?, ?, ?)',
            [EMPRESA_ID, item.item_id, 'entrada', Number(item.quantidade || 0), 'Estorno de atendimento', comanda.id]
          ).catch(() => undefined);
        }
      }

      await execute(
        "DELETE FROM despesas WHERE empresa_id = ? AND categoria = 'Comissão' AND observacao LIKE ?",
        [EMPRESA_ID, `%Agendamento #${req.params.id}.%`]
      ).catch(() => undefined);

      await execute(
        "UPDATE agendamentos SET status = 'Agendado', forma_pagamento = 'Pendente', observacao = CONCAT(COALESCE(observacao, ''), ?) WHERE id = ? AND empresa_id = ?",
        [`\n--- ESTORNO ---\nData: ${dataHoje}\nValor estornado: ${totalEstorno.toFixed(2)}\nMotivo: ${motivo}`, req.params.id, EMPRESA_ID]
      );

      ok(res, { valorEstornado: totalEstorno, motivo });
    } catch (error) { fail(res, error); }
  });

  app.post('/api/despesas/pagar-lote', async (req, res) => {
    try {
      const b = req.body || {};
      const ids = Array.isArray(b.ids) ? b.ids.filter(Boolean) : [];
      await ensureFinanceiroColumns();
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS lote_pagamento VARCHAR(80) NULL").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS motivo_estorno TEXT NULL").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_estorno DATE NULL").catch(() => undefined);
      const forma = b.forma || 'Pix';
      const observacao = b.observacao || '';

      if (!ids.length) throw new Error('Nenhuma despesa selecionada');

      const placeholders = ids.map(() => '?').join(',');
      const rows = await query(
        `SELECT * FROM despesas WHERE empresa_id = ? AND status <> 'Pago' AND status <> 'Estornado' AND id IN (${placeholders})`,
        [EMPRESA_ID, ...ids]
      );

      if (!rows.length) throw new Error('Nenhuma despesa pendente encontrada');

      const total = rows.reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
      const categorias = Array.from(new Set(rows.map((d: any) => d.categoria).filter(Boolean)));
      const descricao = b.descricao || `Pagamento de despesas (${rows.length} item(ns)) - ${categorias.join(', ') || 'geral'}`;
      const dataHoje = toDateISO(b.dataPagamento || new Date().toISOString().slice(0, 10));
      const lotePagamento = b.lotePagamento || `DESP-${dataHoje.replace(/-/g, '')}-${Date.now().toString().slice(-5)}`;

      await execute(
        `UPDATE despesas SET status = 'Pago', data_pagamento = ?, forma = ?, lote_pagamento = ?, observacao = CONCAT(COALESCE(observacao, ''), ?)
         WHERE empresa_id = ? AND id IN (${placeholders})`,
        [dataHoje, forma, lotePagamento, `
Pagamento em lote: ${descricao}. Forma: ${forma}. Lote: ${lotePagamento}. ${observacao}`, EMPRESA_ID, ...rows.map((d: any) => d.id)]
      );

      const fluxo = await execute(
        'INSERT INTO fluxo_caixa (empresa_id, tipo, descricao, valor, data_movimento, origem, referencia_id, forma, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [EMPRESA_ID, 'Saída', descricao, total, dataHoje, 'Despesa', lotePagamento, forma, 'Pago']
      );

      const atualizadas = await query(
        `SELECT * FROM despesas WHERE empresa_id = ? AND id IN (${placeholders})`,
        [EMPRESA_ID, ...rows.map((d: any) => d.id)]
      );

      ok(res, { total, quantidade: rows.length, lotePagamento, fluxoId: String(fluxo.insertId), despesas: atualizadas.map(mapDespesa) });
    } catch (error) { fail(res, error); }
  });

  app.get('/api/comissoes', async (_req, res) => {
    try {
      const rows = await query("SELECT * FROM despesas WHERE empresa_id = ? AND categoria = 'Comissão' ORDER BY id DESC", [EMPRESA_ID]);
      ok(res, rows.map(mapDespesa));
    } catch (error) { fail(res, error); }
  });

  app.post('/api/comissoes/:id/pagar', async (req, res) => {
    try {
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS forma VARCHAR(40) NULL").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS fornecedor VARCHAR(150) NULL").catch(() => undefined);
      await execute("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente TINYINT(1) NOT NULL DEFAULT 0").catch(() => undefined);
      const forma = req.body?.forma || 'Pix';
      const rows = await query("SELECT * FROM despesas WHERE id = ? AND empresa_id = ? AND categoria = 'Comissão' LIMIT 1", [req.params.id, EMPRESA_ID]);
      const despesa = rows[0];
      if (!despesa) throw new Error('Comissão não encontrada');
      if (despesa.status === 'Pago') {
        ok(res, mapDespesa(despesa));
        return;
      }

      const dataHoje = new Date().toISOString().slice(0, 10);
      await execute("UPDATE despesas SET status = 'Pago', data_pagamento = ?, forma = ? WHERE id = ? AND empresa_id = ?", [dataHoje, forma, req.params.id, EMPRESA_ID]);
      await execute(
        'INSERT INTO fluxo_caixa (empresa_id, tipo, descricao, valor, data_movimento, origem, referencia_id, forma, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [EMPRESA_ID, 'Saída', despesa.descricao || 'Pagamento de comissão', Number(despesa.valor || 0), dataHoje, 'Comissão', req.params.id, forma, 'Pago']
      );
      const atualizada = await query('SELECT * FROM despesas WHERE id = ?', [req.params.id]);
      ok(res, atualizada[0] ? mapDespesa(atualizada[0]) : true);
    } catch (error) { fail(res, error); }
  });


  // =========================
  // BACKUP POR EMPRESA - ADMIN MASTER
  // =========================
  function escapeSqlValue(valor: any) {
    if (valor === null || valor === undefined) return "NULL";
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
      return `'${valor.toISOString().slice(0, 19).replace("T", " ")}'`;
    }
    if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "NULL";
    if (typeof valor === "boolean") return valor ? "1" : "0";

    const texto = String(valor)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\u0000/g, "");

    return `'${texto}'`;
  }

  function nomeArquivoSeguro(valor: any) {
    return String(valor || "empresa")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "empresa";
  }

  function insertSql(tabela: string, rows: any[]) {
    if (!rows.length) return `-- Tabela ${tabela}: nenhum registro encontrado.\n`;

    const colunas = Object.keys(rows[0]);
    const colunasSql = colunas.map((c) => `\`${c}\``).join(", ");

    const linhas = rows.map((row) => {
      const valores = colunas.map((c) => escapeSqlValue(row[c])).join(", ");
      return `INSERT INTO \`${tabela}\` (${colunasSql}) VALUES (${valores});`;
    });

    return [
      `-- Tabela ${tabela}: ${rows.length} registro(s)`,
      `SET FOREIGN_KEY_CHECKS=0;`,
      ...linhas,
      `SET FOREIGN_KEY_CHECKS=1;`,
      "",
    ].join("\n");
  }

  app.get("/api/master/empresas/:id/backup", async (req, res) => {
    try {
      await ensureMultiEmpresaTables();

      const empresaId = Number(req.params.id || 0);
      if (!empresaId) throw new Error("Empresa inválida para backup.");

      const empresaRows = await query("SELECT * FROM empresas WHERE id = ? LIMIT 1", [empresaId]);
      const empresa = empresaRows[0];
      if (!empresa) throw new Error("Empresa não encontrada para backup.");

      const dbRows = await query("SELECT DATABASE() AS banco");
      const bancoAtual = dbRows[0]?.banco || "";

      const tabelasComEmpresaId = await query(
        `SELECT TABLE_NAME AS tabela
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND COLUMN_NAME = 'empresa_id'
          GROUP BY TABLE_NAME
          ORDER BY TABLE_NAME`
      );

      const agora = new Date();
      const dataArquivo = agora.toISOString().slice(0, 10);
      const dataHora = agora.toISOString().replace("T", " ").slice(0, 19);
      const nomeSeguro = nomeArquivoSeguro(empresa.slug || empresa.nome || empresaId);

      const partes: string[] = [];
      partes.push(`-- Oliver ERP - Backup individual por empresa`);
      partes.push(`-- Banco origem: ${bancoAtual}`);
      partes.push(`-- Empresa ID: ${empresaId}`);
      partes.push(`-- Empresa: ${empresa.nome || ""}`);
      partes.push(`-- Slug: ${empresa.slug || ""}`);
      partes.push(`-- Gerado em: ${dataHora}`);
      partes.push("");
      partes.push("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';");
      partes.push("SET FOREIGN_KEY_CHECKS=0;");
      partes.push("");

      partes.push("-- Registro da empresa");
      partes.push(insertSql("empresas", empresaRows));

      for (const item of tabelasComEmpresaId) {
        const tabela = String(item.tabela || "");
        if (!tabela || tabela === "empresas") continue;

        const rows = await query(`SELECT * FROM \`${tabela}\` WHERE empresa_id = ?`, [empresaId]).catch(() => []);
        partes.push(insertSql(tabela, rows));
      }

      partes.push("SET FOREIGN_KEY_CHECKS=1;");
      partes.push("-- Fim do backup");
      partes.push("");

      const sql = partes.join("\n");
      const arquivo = `backup_${nomeSeguro}_${dataArquivo}.sql`;

      res.setHeader("Content-Type", "application/sql; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"${arquivo}\"`);
      res.send(sql);
    } catch (error) {
      fail(res, error);
    }
  });

}
