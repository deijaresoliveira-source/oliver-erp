
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { registerApiRoutes } from "./routes";
import { query, withEmpresaContext } from "./db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function primeiroSegmento(url: string) {
  const seg = String(url || "").split("?")[0].split("/").filter(Boolean)[0] || "";

  const reservados = new Set([
    "api",
    "admin",
    "admin-master",
    "assets",
    "uploads",
    "agendar",
    "login",
    "cadastrar-empresa",
    "empresa-nao-informada",
  ]);

  return reservados.has(seg) ? "" : seg;
}

function hostSemPorta(req: express.Request) {
  return String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

function slugDoSubdominio(req: express.Request) {
  const host = hostSemPorta(req);
  if (!host || host === "localhost" || /^127\./.test(host)) return "";

  const partes = host.split(".").filter(Boolean);
  if (partes.length < 3) return "";

  const primeiro = partes[0];
  const reservados = new Set(["www", "app", "api", "master", "admin", "admin-master"]);
  return reservados.has(primeiro) ? "" : primeiro;
}

function rotaLivreSemEmpresa(req: express.Request) {
  const url = String(req.originalUrl || "");

  // Em empresa.olivererp.com, /login e / devem carregar o contexto da empresa.
  const temSubdominioEmpresa = Boolean(slugDoSubdominio(req));

  return (
    (!temSubdominioEmpresa && url === "/") ||
    (!temSubdominioEmpresa && url === "/login") ||
    url === "/cadastrar-empresa" ||
    url === "/empresa-nao-informada" ||
    url.startsWith("/api/publico/cadastrar-empresa") ||
    url.startsWith("/api/health") ||
    url.startsWith("/api/master") ||
    url.startsWith("/admin") ||
    url.startsWith("/admin-master") ||
    url.startsWith("/assets") ||
    url.startsWith("/uploads")
  );
}

async function resolverEmpresa(req: express.Request) {
  const body: any = req.body || {};
  const queryParams: any = req.query || {};

  // Rotas livres não podem tentar resolver slug por body/header.
  // Isso evita erro "Empresa não encontrada" no cadastro de nova empresa.
  if (rotaLivreSemEmpresa(req)) {
    return { empresaId: 0, empresaSlug: "" };
  }

  const slug = String(
    slugDoSubdominio(req) ||
      body.empresaSlug ||
      body.slug ||
      queryParams.empresaSlug ||
      queryParams.slug ||
      req.headers["x-empresa-slug"] ||
      primeiroSegmento(req.originalUrl) ||
      ""
  )
    .trim()
    .toLowerCase();

  if (slug) {
    const rows = await query<any>(
      "SELECT id, slug FROM empresas WHERE slug = ? LIMIT 1",
      [slug]
    ).catch(() => []);

    if (rows[0]) {
      return { empresaId: Number(rows[0].id), empresaSlug: rows[0].slug };
    }

    const erro: any = new Error("Empresa não encontrada.");
    erro.status = 404;
    throw erro;
  }

  const erro: any = new Error("Empresa não informada.");
  erro.status = 400;
  throw erro;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/uploads", express.static(path.resolve(process.cwd(), "server", "uploads")));

  app.use(async (req, res, next) => {
    try {
      const ctx = await resolverEmpresa(req);
      withEmpresaContext(ctx, () => next());
    } catch (error: any) {
      const status = Number(error?.status || 400);
      const url = String(req.originalUrl || "");

      if (
        url.startsWith("/api/master") ||
        url.startsWith("/admin") ||
        url.startsWith("/admin-master") ||
        url.startsWith("/api/publico/cadastrar-empresa")
      ) {
        withEmpresaContext({ empresaId: 0, empresaSlug: "" }, () => next());
        return;
      }

      if (url.startsWith("/api")) {
        res.status(status).json({
          ok: false,
          error: error?.message || "Empresa não informada.",
        });
        return;
      }

      withEmpresaContext({ empresaId: 0, empresaSlug: "" }, () => next());
    }
  });

  registerApiRoutes(app);

  if (process.env.NODE_ENV === "production") {
    const staticPath = path.resolve(projectRoot, "dist", "public");
    app.use(express.static(staticPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      configFile: path.resolve(projectRoot, "vite.config.ts"),
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });

    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = await vite.transformIndexHtml(
          url,
          await import("node:fs/promises").then((fs) =>
            fs.readFile(path.resolve(projectRoot, "client", "index.html"), "utf-8")
          )
        );
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server + Banco rodando em http://localhost:${port}/`);
    console.log(`Teste do banco/API: http://localhost:${port}/api/health`);
  });
}

startServer().catch((error) => {
  console.error("Erro ao iniciar servidor:", error);
  process.exit(1);
});
