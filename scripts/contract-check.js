#!/usr/bin/env node
/**
 * contract-check.js
 *
 * Verifies that every frontend API call (sacred-connect/services) has a
 * matching backend route (BMPserver/routes + server.js mount prefixes).
 *
 * Status per FE call:
 *   MATCH                - method + path shape line up
 *   PARAM_NAME_MISMATCH  - shape matches but a path-param name differs (warning)
 *   NO_MATCH             - no backend route matches (failure)
 *
 * Exit code 1 if any NO_MATCH, else 0.
 *
 * Frontend root defaults to a sibling checkout of sacred-connect; override
 * with the FRONTEND_DIR env var.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const FRONTEND_ROOT =
  process.env.FRONTEND_DIR || path.resolve(BACKEND_ROOT, '..', 'sacred-connect');
const FRONTEND_SERVICES = path.join(FRONTEND_ROOT, 'services');
// The FE axios client baseURL ends in /api (see sacred-connect/api/index.ts +
// EXPO_PUBLIC_API_URL), so every FE path is implicitly prefixed with /api.
const FE_BASE_PREFIX = '/api';

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'];

// ---------------------------------------------------------------------------
// Generic source helpers
// ---------------------------------------------------------------------------

/**
 * Replaces comment contents with spaces (offsets and newlines preserved) so
 * that later regex/scanning passes never trip on commented-out code.
 * String and template literals are left intact.
 */
function stripComments(src) {
  const out = src.split('');
  let i = 0;
  let state = 'code'; // code | line | block | single | double | template
  const templateDepth = []; // tracks ${} nesting inside template literals

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (state === 'code') {
      if (c === '/' && next === '/') state = 'line';
      else if (c === '/' && next === '*') state = 'block';
      else if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'template';
      if (state === 'line' || state === 'block') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
        continue;
      }
    } else if (state === 'line') {
      if (c === '\n') state = 'code';
      else out[i] = ' ';
    } else if (state === 'block') {
      if (c === '*' && next === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        state = 'code';
        i += 2;
        continue;
      }
      if (c !== '\n') out[i] = ' ';
    } else if (state === 'single') {
      if (c === '\\') i++;
      else if (c === "'") state = 'code';
    } else if (state === 'double') {
      if (c === '\\') i++;
      else if (c === '"') state = 'code';
    } else if (state === 'template') {
      if (c === '\\') i++;
      else if (c === '$' && next === '{') {
        templateDepth.push(1);
        state = 'code'; // expressions inside ${} are code again
        i += 2;
        continue;
      } else if (c === '`') state = 'code';
    }

    // leaving a ${...} expression returns us to template state
    if (state === 'code' && templateDepth.length > 0) {
      if (c === '{') templateDepth[templateDepth.length - 1]++;
      else if (c === '}') {
        templateDepth[templateDepth.length - 1]--;
        if (templateDepth[templateDepth.length - 1] === 0) {
          templateDepth.pop();
          state = 'template';
        }
      }
    }

    i++;
  }
  return out.join('');
}

function lineOf(src, offset) {
  return src.slice(0, offset).split('\n').length;
}

function skipWhitespace(src, i) {
  while (i < src.length && /\s/.test(src[i])) i++;
  return i;
}

/** Skips a balanced <...> generic type argument list. Returns index after '>'. */
function skipGenerics(src, i) {
  // src[i] === '<'
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
    } else if (c === '<') depth++;
    else if (c === '>' && src[i - 1] !== '=') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return i;
}

/** Reads a quoted string literal starting at src[i]. Returns { value, end }. */
function readStringLiteral(src, i) {
  const quote = src[i];
  let value = '';
  i++;
  while (i < src.length && src[i] !== quote) {
    if (src[i] === '\\') {
      value += src[i + 1];
      i += 2;
      continue;
    }
    value += src[i];
    i++;
  }
  return { value, end: i + 1 };
}

/**
 * Reads a template literal starting at src[i] (the backtick). Converts each
 * ${expr} into :paramName (first identifier found in the expression, falling
 * back to "param"). Returns { value, end }.
 */
function readTemplateLiteral(src, i) {
  let value = '';
  i++; // skip opening backtick
  while (i < src.length && src[i] !== '`') {
    if (src[i] === '\\') {
      value += src[i + 1];
      i += 2;
      continue;
    }
    if (src[i] === '$' && src[i + 1] === '{') {
      let depth = 1;
      let expr = '';
      i += 2;
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        if (depth > 0) expr += src[i];
        i++;
      }
      const ident = expr.match(/[A-Za-z_$][\w$]*/);
      value += ':' + (ident ? ident[0] : 'param');
      continue;
    }
    value += src[i];
    i++;
  }
  return { value, end: i + 1 };
}

// ---------------------------------------------------------------------------
// Frontend extraction
// ---------------------------------------------------------------------------

function walkTsFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/**
 * Given a variable name used as the path argument (e.g. api.get(path)),
 * finds its most recent declaration before callOffset and extracts every
 * string/template literal in the initializer (ternaries yield several).
 */
function resolvePathVariable(src, varName, callOffset) {
  const declRe = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=`, 'g');
  let declStart = -1;
  let m;
  while ((m = declRe.exec(src)) !== null) {
    if (m.index >= callOffset) break;
    declStart = m.index + m[0].length;
  }
  if (declStart === -1) return null;

  const semi = src.indexOf(';', declStart);
  const initializer = src.slice(declStart, semi === -1 ? declStart + 500 : semi);

  // Only literals that look like URL paths count — initializers like
  // `role === 'priest' ? '/priest/x' : '/devotee/x'` also contain the
  // comparison literal 'priest', which is not a path.
  const literals = [];
  let i = 0;
  while (i < initializer.length) {
    const c = initializer[i];
    if (c === "'" || c === '"') {
      const { value, end } = readStringLiteral(initializer, i);
      if (value.startsWith('/')) literals.push(value);
      i = end;
    } else if (c === '`') {
      const { value, end } = readTemplateLiteral(initializer, i);
      if (value.startsWith('/')) literals.push(value);
      i = end;
    } else i++;
  }
  return literals.length > 0 ? literals : null;
}

function normalizeFePath(raw) {
  let p = raw.split('?')[0]; // drop query string
  if (!p.startsWith('/')) p = '/' + p;
  p = (FE_BASE_PREFIX + p).replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function extractFrontendCalls() {
  const calls = [];
  const problems = [];

  for (const file of walkTsFiles(FRONTEND_SERVICES)) {
    const raw = fs.readFileSync(file, 'utf8');
    const src = stripComments(raw);
    const rel = path.relative(FRONTEND_ROOT, file).replace(/\\/g, '/');

    const callRe = /\bapi\s*\.\s*(get|post|put|delete|patch)\b/g;
    let m;
    while ((m = callRe.exec(src)) !== null) {
      const method = m[1].toUpperCase();
      const line = lineOf(src, m.index);
      let i = skipWhitespace(src, m.index + m[0].length);

      if (src[i] === '<') i = skipGenerics(src, i); // generic type args
      i = skipWhitespace(src, i);
      if (src[i] !== '(') continue; // property access, not a call
      i = skipWhitespace(src, i + 1);

      const c = src[i];
      let rawPaths = null;
      if (c === "'" || c === '"') {
        rawPaths = [readStringLiteral(src, i).value];
      } else if (c === '`') {
        rawPaths = [readTemplateLiteral(src, i).value];
      } else {
        const ident = src.slice(i).match(/^[A-Za-z_$][\w$]*/);
        if (ident) rawPaths = resolvePathVariable(src, ident[0], m.index);
      }

      if (!rawPaths) {
        problems.push(
          `${rel}:${line} - could not statically determine the URL for api.${m[1]}(...)`
        );
        continue;
      }

      for (const rawPath of rawPaths) {
        calls.push({
          method,
          path: normalizeFePath(rawPath),
          source: `${rel}:${line}`,
        });
      }
    }
  }

  // de-duplicate identical method+path (keep first source)
  const seen = new Map();
  for (const call of calls) {
    const key = `${call.method} ${call.path}`;
    if (!seen.has(key)) seen.set(key, call);
  }
  return { calls: [...seen.values()], problems };
}

// ---------------------------------------------------------------------------
// Backend extraction
// ---------------------------------------------------------------------------

function extractMounts() {
  const serverSrc = stripComments(
    fs.readFileSync(path.join(BACKEND_ROOT, 'server.js'), 'utf8')
  );

  // const priestRoutes = require('./routes/priestRoutes');
  const varToFile = new Map();
  const reqRe = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"]\.\/routes\/([\w-]+)['"]\s*\)/g;
  let m;
  while ((m = reqRe.exec(serverSrc)) !== null) varToFile.set(m[1], m[2]);

  // app.use('/api/priest', priestRoutes)  or  app.use('/api/test', require('./routes/testFixtures'))
  const mounts = []; // { prefix, file }
  const useRe =
    /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(?:require\(\s*['"]\.\/routes\/([\w-]+)['"]\s*\)|(\w+))\s*\)/g;
  while ((m = useRe.exec(serverSrc)) !== null) {
    const prefix = m[1];
    const file = m[2] || varToFile.get(m[3]);
    if (file) mounts.push({ prefix, file });
  }
  return mounts;
}

function extractBackendRoutes() {
  const routes = [];
  for (const { prefix, file } of extractMounts()) {
    const filePath = path.join(BACKEND_ROOT, 'routes', `${file}.js`);
    if (!fs.existsSync(filePath)) {
      console.error(`WARN: mounted routes file not found: ${filePath}`);
      continue;
    }
    const src = stripComments(fs.readFileSync(filePath, 'utf8'));

    // router.get('/path', ...)  — first arg may sit on the next line
    const routeRe = /\brouter\s*\.\s*(get|post|put|delete|patch)\s*\(/g;
    let m;
    while ((m = routeRe.exec(src)) !== null) {
      const i = skipWhitespace(src, m.index + m[0].length);
      if (src[i] !== "'" && src[i] !== '"' && src[i] !== '`') continue;
      const routePath =
        src[i] === '`'
          ? readTemplateLiteral(src, i).value
          : readStringLiteral(src, i).value;
      let full = (prefix + '/' + routePath).replace(/\/{2,}/g, '/');
      if (full.length > 1 && full.endsWith('/')) full = full.slice(0, -1);
      routes.push({
        method: m[1].toUpperCase(),
        path: full,
        source: `routes/${file}.js:${lineOf(src, m.index)}`,
      });
    }

    // router.route('/path').get(...).post(...)
    const chainRe = /\brouter\s*\.\s*route\s*\(\s*(['"`])([^'"`]*)\1\s*\)((?:\s*\.\s*(?:get|post|put|delete|patch)\s*\()[^]*?)(?=\brouter\b|$)/g;
    while ((m = chainRe.exec(src)) !== null) {
      const methodRe = /\.\s*(get|post|put|delete|patch)\s*\(/g;
      let mm;
      while ((mm = methodRe.exec(m[3])) !== null) {
        let full = (prefix + '/' + m[2]).replace(/\/{2,}/g, '/');
        if (full.length > 1 && full.endsWith('/')) full = full.slice(0, -1);
        routes.push({
          method: mm[1].toUpperCase(),
          path: full,
          source: `routes/${file}.js:${lineOf(src, m.index)}`,
        });
      }
    }
  }
  return routes;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function segments(p) {
  return p.split('/').filter(Boolean);
}

/**
 * A FE segment matches a BE segment when:
 *   - both are literals and equal (score 2)
 *   - FE is a param and BE is a param (score 1)
 *   - FE is a literal and BE is a param (Express would route it; score 0)
 * FE param vs BE literal never matches (a dynamic value only coincidentally
 * hits one specific literal route).
 */
function matchRoute(feCall, beRoutes) {
  const feSegs = segments(feCall.path);
  let best = null;

  for (const route of beRoutes) {
    if (route.method !== feCall.method) continue;
    const beSegs = segments(route.path);
    if (beSegs.length !== feSegs.length) continue;

    let score = 0;
    let ok = true;
    const paramMismatches = [];
    for (let i = 0; i < feSegs.length; i++) {
      const fe = feSegs[i];
      const be = beSegs[i];
      const feParam = fe.startsWith(':');
      const beParam = be.startsWith(':');
      if (!feParam && !beParam) {
        if (fe !== be) {
          ok = false;
          break;
        }
        score += 2;
      } else if (feParam && beParam) {
        score += 1;
        if (fe !== be) paramMismatches.push(`${fe} vs ${be}`);
      } else if (feParam && !beParam) {
        ok = false;
        break;
      }
      // literal FE vs :param BE -> allowed, score 0
    }
    if (!ok) continue;
    if (!best || score > best.score) best = { route, score, paramMismatches };
  }

  if (!best) return { status: 'NO_MATCH', route: null, detail: '' };
  if (best.paramMismatches.length > 0) {
    return {
      status: 'PARAM_NAME_MISMATCH',
      route: best.route,
      detail: best.paramMismatches.join(', '),
    };
  }
  return { status: 'MATCH', route: best.route, detail: '' };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(FRONTEND_SERVICES)) {
    console.error(
      `ERROR: frontend services dir not found: ${FRONTEND_SERVICES}\n` +
        'Set FRONTEND_DIR to the sacred-connect checkout path.'
    );
    process.exit(1);
  }

  const { calls, problems } = extractFrontendCalls();
  const beRoutes = extractBackendRoutes();

  const results = calls
    .map((call) => ({ call, ...matchRoute(call, beRoutes) }))
    .sort((a, b) =>
      a.call.path === b.call.path
        ? a.call.method.localeCompare(b.call.method)
        : a.call.path.localeCompare(b.call.path)
    );

  const rows = results.map((r) => [
    `${r.call.method} ${r.call.path}`,
    r.route ? `${r.route.method} ${r.route.path}` : '—',
    r.status + (r.detail ? ` (${r.detail})` : ''),
  ]);
  const headers = ['FE call', 'Matched BE route', 'Status'];
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i].length))
  );
  const fmt = (row) => row.map((cell, i) => cell.padEnd(widths[i])).join('  | ');

  console.log(`Frontend: ${FRONTEND_SERVICES}`);
  console.log(`Backend:  ${BACKEND_ROOT}`);
  console.log(`FE calls: ${calls.length}   BE routes: ${beRoutes.length}\n`);
  console.log(fmt(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('--|-') + '-');
  for (const row of rows) console.log(fmt(row));

  const noMatch = results.filter((r) => r.status === 'NO_MATCH');
  const warnings = results.filter((r) => r.status === 'PARAM_NAME_MISMATCH');

  console.log('');
  if (problems.length > 0) {
    console.log('!! UNPARSED FE CALLS (fix contract-check.js parsing, do not ignore):');
    for (const p of problems) console.log(`   ${p}`);
    console.log('');
  }
  if (warnings.length > 0) {
    console.log('⚠ PARAM_NAME_MISMATCH (param name differs between FE and BE):');
    for (const r of warnings) {
      console.log(
        `   ${r.call.method} ${r.call.path}  (FE ${r.call.source})  vs  ${r.route.path}  (BE ${r.route.source})  [${r.detail}]`
      );
    }
    console.log('');
  }
  if (noMatch.length > 0) {
    console.log('✖ NO_MATCH (FE calls an endpoint the backend does not serve):');
    for (const r of noMatch) {
      console.log(`   ${r.call.method} ${r.call.path}  (FE ${r.call.source})`);
    }
    console.log('');
    console.log(`FAILED: ${noMatch.length} unmatched FE call(s).`);
    process.exit(1);
  }

  console.log(
    `OK: all ${calls.length} FE calls have a matching backend route` +
      (warnings.length > 0 ? ` (${warnings.length} param-name warning(s))` : '') +
      (problems.length > 0 ? ` — but ${problems.length} call(s) could not be parsed` : '') +
      '.'
  );
  // Unparsed calls also mean the contract is not fully verified — fail.
  if (problems.length > 0) process.exit(1);
}

main();
