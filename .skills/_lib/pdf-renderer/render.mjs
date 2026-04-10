#!/usr/bin/env node
/**
 * pdf-renderer / render.mjs
 *
 * Recebe markdown + template HTML + CSS + variáveis e gera PDF.
 * Domain-agnostic — não conhece nenhum conceito de processo do framework.
 *
 * Uso:
 *   node render.mjs --in <md> --out <pdf> [--template <html>] [--styles <css>] [--variables <json>]
 *
 * Exit codes:
 *   0 — sucesso
 *   1 — erro de uso (args inválidos, arquivo não encontrado)
 *   2 — falha na geração do PDF
 */

import { mdToPdf } from 'md-to-pdf';
import { readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLI args
const argv = process.argv.slice(2);
function arg(name, fallback = null) {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
}

const inputPath = arg('in');
const outputPath = arg('out');
const templatePath = arg('template', resolve(__dirname, 'templates/report-default.html'));
const stylesPath = arg('styles', resolve(__dirname, 'styles/default.css'));
const variablesJson = arg('variables', '{}');

if (!inputPath || !outputPath) {
  console.error('Uso: node render.mjs --in <md> --out <pdf> [--template <html>] [--styles <css>] [--variables <json>]');
  process.exit(1);
}

let variables;
try {
  variables = JSON.parse(variablesJson);
} catch (e) {
  console.error(`--variables JSON inválido: ${e.message}`);
  process.exit(1);
}

// Carrega template HTML e extrai <header> e <footer>
let templateHtml;
try {
  templateHtml = readFileSync(templatePath, 'utf-8');
} catch (e) {
  console.error(`Não foi possível ler template em ${templatePath}: ${e.message}`);
  process.exit(1);
}

function extractTag(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = html.match(re);
  return match ? match[1].trim() : '';
}

function applyVars(html, vars) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

const headerHtml = applyVars(extractTag(templateHtml, 'header'), variables);
const footerHtml = applyVars(extractTag(templateHtml, 'footer'), variables);

// Carrega CSS e injeta variáveis CSS customizadas
let baseCss;
try {
  baseCss = readFileSync(stylesPath, 'utf-8');
} catch (e) {
  console.error(`Não foi possível ler CSS em ${stylesPath}: ${e.message}`);
  process.exit(1);
}

function injectCssVars(css, customVars) {
  if (!customVars || typeof customVars !== 'object' || Object.keys(customVars).length === 0) {
    return css;
  }
  const decls = Object.entries(customVars)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n');
  if (css.includes(':root {')) {
    return css.replace(':root {', `:root {\n${decls}`);
  }
  return `:root {\n${decls}\n}\n${css}`;
}

const finalCss = injectCssVars(baseCss, variables.css);

// Renderiza
try {
  const pdf = await mdToPdf(
    { path: inputPath },
    {
      dest: outputPath,
      css: finalCss,
      document_title: variables.titulo ?? variables.titulo_curto ?? 'Relatório',
      pdf_options: {
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: headerHtml || '<span></span>',
        footerTemplate: footerHtml || '<span></span>',
        margin: { top: '25mm', bottom: '20mm', left: '18mm', right: '18mm' },
      },
    }
  );

  if (!pdf) {
    console.error('Geração de PDF retornou null');
    process.exit(2);
  }

  const stats = statSync(outputPath);
  console.log(JSON.stringify({ ok: true, path: outputPath, tamanho_bytes: stats.size }));
} catch (e) {
  console.error(`Falha na geração do PDF: ${e.message}`);
  process.exit(2);
}
