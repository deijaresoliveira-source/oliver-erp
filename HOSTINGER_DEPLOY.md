# Oliver ERP - Deploy Hostinger

Esta versão mantém a estrutura original do projeto em `apps/beauty`.

## Configuração na Hostinger

Use o repositório pela raiz do projeto.

Comandos:
- Install: `npm install`
- Build: `npm run build`
- Start: `npm start`

Node:
- Node.js 20.x

## Variáveis de ambiente

Configure na Hostinger, não envie `.env` para o GitHub:

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nome_do_banco_hostinger
DB_USER=usuario_do_banco
DB_PASSWORD=senha_do_banco
NODE_ENV=production
PORT=3000
JWT_SECRET=crie_uma_chave_forte
SESSION_SECRET=crie_uma_chave_forte
```

## Multiempresa

O projeto não foi convertido para empresa única. A estrutura `apps/beauty` foi preservada.
A separação de empresas continua dependendo da lógica do sistema e do campo `empresa_id`.
