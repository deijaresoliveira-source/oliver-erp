# Oliver ERP - Arquitetura Definitiva

## Objetivo

O Oliver ERP será um projeto único chamado `Oliver_ERP`, com um Core central responsável por autenticação, empresas, planos, assinaturas, subdomínios, painel master, site institucional e carregamento dos sistemas.

Os sistemas Oliver Beauty, Oliver Fit, Oliver Clinic e futuros sistemas devem permanecer praticamente intactos.

## Princípio principal

O Core não deve alterar layout, CSS, tema ou estrutura interna dos sistemas.

O Core apenas identifica a empresa, valida o acesso e carrega o sistema correto.

## Estrutura

```txt
Oliver_ERP/
├── apps/
│   ├── core/
│   │   ├── server/
│   │   └── client/
│   ├── beauty/
│   ├── fit/
│   └── clinic/
├── packages/
│   ├── auth/
│   ├── database/
│   ├── types/
│   ├── utils/
│   ├── api-client/
│   ├── config/
│   └── ui/
├── infrastructure/
└── docs/
```

## Fluxo

```txt
cliente.olivererp.com
↓
Core identifica o subdomínio
↓
Core consulta a empresa no banco
↓
Core verifica status, plano e sistema contratado
↓
Core libera login
↓
Core carrega Beauty, Fit ou Clinic
```

## Sistemas

- `apps/beauty`: barbearia, salão, estética e beleza.
- `apps/fit`: academia.
- `apps/clinic`: clínicas.

## Migração do Beauty

A migração será feita depois, copiando o sistema atual para `apps/beauty` e criando apenas um adaptador para receber dados do Core.

Não mudar CSS, layout, temas ou componentes internos do Beauty durante a primeira migração.
