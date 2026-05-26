# GeoSPT — Projeto pronto para Vite

Este pacote transforma o arquivo `geospt_app(1).jsx` em um projeto React/Vite executável.

## 1. Local recomendado

Extraia esta pasta em um caminho local simples, por exemplo:

```text
C:\Projetos\geospt-vite-sem-xlsx
```

Evite rodar `npm install` dentro de Google Drive, OneDrive, Dropbox ou pastas sincronizadas. Essas pastas podem gerar erros de escrita durante a criação da pasta `node_modules`.

## 2. Instalação

Abra o terminal dentro da pasta do projeto e rode:

```bash
npm install
```

## 3. Desenvolvimento

```bash
npm run dev
```

Abra no navegador o endereço indicado pelo terminal, normalmente:

```text
http://localhost:5173/
```

## 4. Build final

```bash
npm run build
```

Isso criará a pasta `dist/`.

Para testar a versão final localmente:

```bash
npm run preview
```

## 5. Onde editar

Edite os arquivos em `src/`, principalmente:

```text
src/App.jsx
```

Não edite arquivos dentro de `dist/`, pois essa pasta é gerada automaticamente pelo build.

## 6. Ajustes feitos

- Adicionado `import React from 'react';` no `src/App.jsx`.
- Removida a dependência `xlsx`/SheetJS para eliminar o alerta de segurança do `npm audit`.
- Substituída a exportação XLSX por um gerador interno mínimo em Office Open XML.
- Criados `main.jsx`, `index.css`, `vite.config.js`, `index.html`, `package.json` e `.gitignore`.
- Incluído `base: './'` no Vite para facilitar publicação em subpastas.


## Observação sobre o alerta do npm audit

Esta versão remove a dependência `xlsx`/SheetJS. A exportação XLSX foi substituída por um gerador interno mínimo em Office Open XML, suficiente para criar um arquivo `.xlsx` com múltiplas abas sem carregar bibliotecas externas.

Com isso, o alerta de segurança associado ao pacote `xlsx` deixa de aparecer no `npm audit`.
