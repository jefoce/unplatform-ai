import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const API_DIR = path.join(process.cwd(), 'src/app/api')
const HANDLER_NAMES = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

interface Handler {
  name: string
  body: ts.Block
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      return routeFiles(full)
    }

    return entry.isFile() && entry.name === 'route.ts' ? [full] : []
  })
}

function isExported(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false
  }

  return (ts.getModifiers(node) ?? []).some((modifier) => {
    return modifier.kind === ts.SyntaxKind.ExportKeyword
  })
}

function blockBody(node: ts.Node): ts.Block | null {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    return node.body && ts.isBlock(node.body) ? node.body : null
  }

  return null
}

function functionHandler(statement: ts.Statement, name: string): Handler | null {
  if (!ts.isFunctionDeclaration(statement) || statement.name?.text !== name) {
    return null
  }

  const body = blockBody(statement)

  if (!body) {
    return null
  }

  return { name, body }
}

function variableHandler(statement: ts.Statement, name: string): Handler | null {
  if (!ts.isVariableStatement(statement)) {
    return null
  }

  const declaration = statement.declarationList.declarations.find((item) => {
    return ts.isIdentifier(item.name) && item.name.text === name
  })

  const body = declaration?.initializer ? blockBody(declaration.initializer) : null

  if (!body) {
    return null
  }

  return { name, body }
}

function localHandler(statements: readonly ts.Statement[], name: string): Handler | null {
  return statements.reduce<Handler | null>((found, statement) => {
    if (found) {
      return found
    }

    return functionHandler(statement, name) ?? variableHandler(statement, name)
  }, null)
}

function exportedFunctionHandler(statement: ts.Statement): Handler | null {
  if (!ts.isFunctionDeclaration(statement) || !isExported(statement)) {
    return null
  }

  const name = statement.name?.text ?? ''

  if (!HANDLER_NAMES.has(name)) {
    return null
  }

  return functionHandler(statement, name)
}

function exportedVariableHandlers(statement: ts.VariableStatement): Handler[] {
  const handlers: Handler[] = []

  for (const declaration of statement.declarationList.declarations) {
    const name = ts.isIdentifier(declaration.name) ? declaration.name.text : ''
    const body = declaration.initializer ? blockBody(declaration.initializer) : null

    if (HANDLER_NAMES.has(name) && body) {
      handlers.push({ name, body })
    }
  }

  return handlers
}

function exportedAliasHandlers(source: ts.SourceFile, statement: ts.Statement): Handler[] {
  if (!ts.isExportDeclaration(statement) || !statement.exportClause) {
    return []
  }

  if (!ts.isNamedExports(statement.exportClause)) {
    return []
  }

  return statement.exportClause.elements.flatMap((specifier) => {
    const name = specifier.name.text

    if (!HANDLER_NAMES.has(name)) {
      return []
    }

    const localName = specifier.propertyName?.text ?? name
    const handler = localHandler(source.statements, localName)

    if (!handler) {
      return []
    }

    return [{ name, body: handler.body }]
  })
}

function httpHandlers(source: ts.SourceFile): Handler[] {
  return source.statements.flatMap((statement) => {
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      return exportedVariableHandlers(statement)
    }

    const handler = exportedFunctionHandler(statement)

    if (handler) {
      return [handler]
    }

    return exportedAliasHandlers(source, statement)
  })
}

function firstStatement(block: ts.Block): ts.Statement | null {
  let statement = block.statements[0]

  while (statement && ts.isTryStatement(statement)) {
    statement = statement.tryBlock.statements[0]
  }

  return statement ?? null
}

function isGuardCall(statement: ts.Statement | null): boolean {
  if (!statement || !ts.isExpressionStatement(statement)) {
    return false
  }

  const expression = statement.expression

  return (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'assertLocalRequest'
  )
}

function unguardedHandlers(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

  return httpHandlers(source)
    .filter((handler) => {
      return !isGuardCall(firstStatement(handler.body))
    })
    .map((handler) => {
      return handler.name
    })
}

describe('route guards', () => {
  it('makes assertLocalRequest the first call in every API handler', () => {
    const files = routeFiles(API_DIR)

    const offenders = files.flatMap((file) => {
      const handlers = unguardedHandlers(file)

      if (handlers.length === 0) {
        return []
      }

      const rel = path.relative(API_DIR, file).split(path.sep).join('/')

      return [`${rel} -> ${handlers.join(', ')}`]
    })

    expect(files.length).toBeGreaterThan(0)
    expect(offenders).toEqual([])
  })
})
