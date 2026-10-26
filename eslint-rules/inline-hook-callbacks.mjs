const FUNCTION_TYPES = new Set(['ArrowFunctionExpression', 'FunctionExpression'])
const HOOK_NAME = /^use[A-Z]/

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

function isInsideFunction(node) {
  let current = node.parent

  while (current) {
    if (FUNCTION_TYPES.has(current.type) || current.type === 'FunctionDeclaration') {
      return true
    }

    current = current.parent
  }

  return false
}

const inlineHookCallbacks = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      inline:
        '{{name}} is only passed to {{hook}}. Write it inline: {{hook}}(async () => { ... }).',
    },
  },
  create(context) {
    const { sourceCode } = context

    return {
      VariableDeclarator(node) {
        if (
          node.id.type !== 'Identifier' ||
          !node.init ||
          !FUNCTION_TYPES.has(node.init.type) ||
          !isInsideFunction(node)
        ) {
          return
        }

        const [variable] = sourceCode.getDeclaredVariables(node)
        const uses = (variable?.references ?? []).filter((ref) => {
          return !ref.init
        })

        if (uses.length !== 1) {
          return
        }

        const { identifier } = uses[0]
        const call = identifier.parent

        if (call?.type !== 'CallExpression' || !call.arguments.includes(identifier)) {
          return
        }

        const hook = calleeName(call)

        if (hook === null || !HOOK_NAME.test(hook)) {
          return
        }

        context.report({ node, messageId: 'inline', data: { name: node.id.name, hook } })
      },
    }
  },
}

export default inlineHookCallbacks
