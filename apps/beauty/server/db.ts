import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

import mysql from "mysql2/promise";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Conexão compatível com Hostinger/produção.
 * Configure as variáveis no painel da hospedagem ou no arquivo .env local.
 * Não deixe usuário/senha fixa no código.
 */
const DATABASE_URL =
  process.env.DATABASE_URL ||
  `mysql://${process.env.DB_USER || ""}:${process.env.DB_PASSWORD || ""}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "3306"}/${process.env.DB_NAME || ""}`;

const EMPRESA_ID_SENTINEL = "__EMPRESA_ID_ATUAL__";
export const EMPRESA_ID: any = EMPRESA_ID_SENTINEL;

type EmpresaContext = { empresaId: number; empresaSlug?: string };
const empresaStore = new AsyncLocalStorage<EmpresaContext>();

export function getEmpresaContext() {
  return empresaStore.getStore() || { empresaId: Number(process.env.EMPRESA_ID || 1), empresaSlug: "letsbarbearia" };
}

export function getEmpresaIdAtual() {
  return Number(getEmpresaContext().empresaId || process.env.EMPRESA_ID || 1);
}

export function withEmpresaContext<T>(ctx: EmpresaContext, fn: () => T) {
  return empresaStore.run(ctx, fn);
}

function normalizarParams(params: any[] = []) {
  return params.map((p) => (p === EMPRESA_ID_SENTINEL ? getEmpresaIdAtual() : p));
}
console.log("========== ENV ==========");
console.log("DB_HOST =", process.env.DB_HOST);
console.log("DB_PORT =", process.env.DB_PORT);
console.log("DB_USER =", process.env.DB_USER);
console.log("DB_PASSWORD =", process.env.DB_PASSWORD ? "********" : "(vazio)");
console.log("DB_NAME =", process.env.DB_NAME);
console.log("DATABASE_URL =", process.env.DATABASE_URL);
console.log("=========================");
let pool: mysql.Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      uri: DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log(
      `Banco configurado em: ${process.env.DB_HOST || "localhost"}/${process.env.DB_NAME || ""}`
    );
  }
  return pool;
}

export async function query<T = any>(sql: string, params: any[] = []) {
  const [rows] = await getPool().query(sql, normalizarParams(params));
  return rows as T[];
}

export async function execute(sql: string, params: any[] = []) {
  const [result] = await getPool().execute(sql, normalizarParams(params));
  return result as mysql.ResultSetHeader;
}

export function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function toDateBR(value: any) {
  if (!value) return "";
  if (value instanceof Date) {
    return value.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }
  const text = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, d] = text.split("-");
    return `${d}/${m}/${y}`;
  }
  return text;
}

export function toDateISO(value: any) {
  if (!value) return hojeISO();
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [d, m, y] = text.split("/");
    return `${y}-${m}-${d}`;
  }
  return text;
}

export function toTime(value: any) {
  if (!value) return "00:00:00";
  const text = String(value).trim();
  if (/^\d{2}:\d{2}$/.test(text)) return `${text}:00`;
  return text;
}

export function fromTime(value: any) {
  if (!value) return "";
  return String(value).slice(0, 5);
}
