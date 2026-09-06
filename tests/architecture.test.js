import { test, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
test('source dependencies point toward inner layers', () => {
  const configPath = path.join(root, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => root,
        getNewLine: () => '\n',
      }),
    );
  const normalize = (file) => path.relative(root, file).replaceAll('\\', '/');
  const layer = (file) => {
    const name = normalize(file);
    if (name.startsWith('src/shared/utils/')) return 'utility';
    if (name.startsWith('src/components/') && name !== 'src/components/AppRoot.tsx')
      return 'presentation';
    if (/^src\/(?:features\/[^/]+\/|shared\/)?domain\//.test(name)) return 'domain';
    if (/^src\/(?:features\/[^/]+\/|shared\/)application\//.test(name)) return 'application';
    if (/^src\/(?:features\/[^/]+\/|shared\/)infrastructure\//.test(name)) return 'infrastructure';
    if (/^src\/(?:features\/[^/]+\/presentation\/|shared\/ui\/)/.test(name)) return 'presentation';
    return null;
  };
  const files = parsed.fileNames.filter((file) => normalize(file).startsWith('src/'));
  const graph = new Map();
  const errors = [];

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const edges = [];
    function visit(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        specifier = node.moduleSpecifier;
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
        specifier = node.argument.literal;
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference))
        specifier = node.moduleReference.expression;
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      )
        specifier = node.arguments[0];
      if (specifier && ts.isStringLiteralLike(specifier)) {
        const request = specifier.text;
        const resolved = ts.resolveModuleName(request, file, parsed.options, ts.sys).resolvedModule;
        const target = resolved?.resolvedFileName;
        const local = target && normalize(target).startsWith('src/');
        const from = layer(file);
        const allowed =
          from === 'utility'
            ? ['utility']
            : from === 'domain'
              ? ['domain', 'utility']
              : ['domain', 'application', 'utility'];
        const location = source.getLineAndCharacterOfPosition(specifier.getStart()).line + 1;
        if (
          ['domain', 'application', 'utility'].includes(from) &&
          (!local || !allowed.includes(layer(target)))
        ) {
          errors.push(`${normalize(file)}:${location}: ${from} cannot import ${request}`);
        }
        if (local && from === 'infrastructure' && layer(target) === 'presentation') {
          errors.push(
            `${normalize(file)}:${location}: infrastructure cannot import presentation ${request}`,
          );
        }
        if (local) edges.push(target);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    graph.set(file, edges);
  }

  // Follow local barrels too, so re-exporting an adapter cannot bypass the rule.
  for (const file of files.filter((name) => layer(name) === 'presentation')) {
    const visited = new Set();
    function inspect(current, route) {
      if (visited.has(current)) return;
      visited.add(current);
      if (layer(current) === 'infrastructure') {
        errors.push(`Presentation depends on infrastructure: ${route.map(normalize).join(' -> ')}`);
        return;
      }
      for (const target of graph.get(current) ?? []) inspect(target, [...route, target]);
    }
    inspect(file, [file]);
  }
  expect(errors).toEqual([]);
});
