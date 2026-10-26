const FUNCTION_TYPES = new Set(['ArrowFunctionExpression', 'FunctionExpression'])
const WRAPPER_TYPES = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression'])
const DEFAULT_WRAPPERS = [
  'useAsyncAction',
  'useCallback',
  'useEffectEvent',
  'memo',
  'forwardRef',
  'debounce',
  'throttle',
]

function unwrap(node) {
  let current = node

  while (current && WRAPPER_TYPES.has(current.type)) {
    current = current.expression
  }

  return current
}

function calleeName(call) {
  const { callee } = call

  if (callee.type === 'Identifier') {
    return callee.name
  }

  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name
  }

  return null
}

function isFunctionValue(init, wrappers) {
  const value = unwrap(init)

  if (!value) {
    return false
  }

  if (FUNCTION_TYPES.has(value.type)) {
    return true
  }

  if (value.type !== 'CallExpression') {
    return false
  }

  const name = calleeName(value)

  return (
    name !== null &&
    wrappers.has(name) &&
    value.arguments.some((arg) => FUNCTION_TYPES.has(arg.type))
  )
}

function isFunctionConst(statement, wrappers) {
  const declaration =
    statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement

  if (!declaration || declaration.type !== 'VariableDeclaration') {
    return false
  }

  return declaration.declarations.some((declarator) => isFunctionValue(declarator.init, wrappers))
}

const paddingAroundFunctions = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [
      {
        type: 'object',
        properties: { wrappers: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: { blankLine: 'Put a blank line before and after a function constant.' },
  },
  create(context) {
    const wrappers = new Set(context.options[0]?.wrappers ?? DEFAULT_WRAPPERS)
    const { sourceCode } = context

    function startLine(statement) {
      const comments = sourceCode.getCommentsBefore(statement)
      let line = statement.loc.start.line

      for (let index = comments.length - 1; index >= 0; index -= 1) {
        if (comments[index].loc.end.line < line - 1) {
          break
        }

        line = comments[index].loc.start.line
      }

      return line
    }

    function insertPoint(statement) {
      const last = sourceCode.getLastToken(statement)
      const trailing = sourceCode
        .getCommentsAfter(last)
        .filter((comment) => comment.loc.start.line === last.loc.end.line)

      return trailing.at(-1) ?? last
    }

    function check(body) {
      for (let index = 1; index < body.length; index += 1) {
        const prev = body[index - 1]
        const next = body[index]

        if (!isFunctionConst(prev, wrappers) && !isFunctionConst(next, wrappers)) {
          continue
        }

        if (startLine(next) - insertPoint(prev).loc.end.line >= 2) {
          continue
        }

        context.report({
          node: next,
          messageId: 'blankLine',
          fix: (fixer) => fixer.insertTextAfter(insertPoint(prev), '\n'),
        })
      }
    }

    return {
      Program: (node) => check(node.body),
      BlockStatement: (node) => check(node.body),
      StaticBlock: (node) => check(node.body),
      SwitchCase: (node) => check(node.consequent),
    }
  },
}

export default paddingAroundFunctions
