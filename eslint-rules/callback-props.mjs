const CALLBACK_PROP = /^on[A-Z]/
const HANDLER_NAME = /^handle[A-Z]/
const STORE_HOOK = /^use\w*Store$/
const FUNCTION_TYPES = new Set(['ArrowFunctionExpression', 'FunctionExpression'])
const WRAPPER_TYPES = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression'])
const FUNCTION_WRAPPERS = new Set(['useCallback', 'useEffectEvent', 'debounce', 'throttle'])
const DEPENDENCY_HOOKS = new Set([
  'useCallback',
  'useMemo',
  'useEffect',
  'useLayoutEffect',
  'useInsertionEffect',
  'useEffectEvent',
  'useImperativeHandle',
])

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

function isCreatedFunction(init) {
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
    FUNCTION_WRAPPERS.has(name) &&
    value.arguments.some((arg) => FUNCTION_TYPES.has(arg.type))
  )
}

function isAlias(init) {
  const value = unwrap(init)

  return value?.type === 'Identifier' || value?.type === 'MemberExpression'
}

function findVariable(scope, name) {
  let current = scope

  while (current) {
    const variable = current.set.get(name)

    if (variable) {
      return variable
    }

    current = current.upper
  }

  return null
}

function isInsideHookCallback(node) {
  let current = node.parent

  while (current) {
    const parent = current.parent

    if (current.type === 'CallExpression' && DEPENDENCY_HOOKS.has(calleeName(current) ?? '')) {
      return true
    }

    current = parent
  }

  return false
}

const callbackProps = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      handlerName: 'A function created here and passed to {{prop}} is named handle<Action>.',
      alias:
        'Do not rename an existing function. Pass it directly (props.onX, a setter, a store action).',
      destructured:
        'Read callbacks as props.{{name}}. Destructure only when every use is inside a hook callback.',
      renamed: 'Keep the callback name: props.{{name}}.',
      callbackName: 'Callback props are named on<Action>.',
      storeName:
        'Name a store selection after the action: const setZoom = useStore((state) => state.setZoom).',
    },
  },
  create(context) {
    const { sourceCode } = context

    return {
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          HANDLER_NAME.test(node.id.name) &&
          isAlias(node.init)
        ) {
          context.report({ node, messageId: 'alias' })
        }

        if (
          node.id.type === 'Identifier' &&
          HANDLER_NAME.test(node.id.name) &&
          node.init?.type === 'CallExpression' &&
          STORE_HOOK.test(calleeName(node.init) ?? '')
        ) {
          context.report({ node, messageId: 'storeName' })
        }

        if (
          node.id.type !== 'ObjectPattern' ||
          node.init?.type !== 'Identifier' ||
          node.init.name !== 'props'
        ) {
          return
        }

        for (const property of node.id.properties) {
          if (
            property.type !== 'Property' ||
            property.key.type !== 'Identifier' ||
            !CALLBACK_PROP.test(property.key.name)
          ) {
            continue
          }

          const local =
            property.value.type === 'AssignmentPattern' ? property.value.left : property.value

          if (local.type !== 'Identifier') {
            continue
          }

          if (local.name !== property.key.name) {
            context.report({
              node: property,
              messageId: 'renamed',
              data: { name: property.key.name },
            })

            continue
          }

          const variable = sourceCode
            .getDeclaredVariables(node)
            .find((item) => item.name === local.name)
          const uses = (variable?.references ?? []).filter((ref) => ref.identifier !== local)
          const isHookOnly =
            uses.length > 0 && uses.every((ref) => isInsideHookCallback(ref.identifier))

          if (!isHookOnly) {
            context.report({
              node: property,
              messageId: 'destructured',
              data: { name: local.name },
            })
          }
        }
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || !CALLBACK_PROP.test(node.name.name)) {
          return
        }

        const expression =
          node.value?.type === 'JSXExpressionContainer' ? node.value.expression : null

        if (expression?.type === 'MemberExpression') {
          if (
            expression.object.type === 'Identifier' &&
            expression.object.name === 'props' &&
            !expression.computed &&
            expression.property.type === 'Identifier' &&
            !CALLBACK_PROP.test(expression.property.name)
          ) {
            context.report({ node, messageId: 'callbackName' })
          }

          return
        }

        if (expression?.type !== 'Identifier') {
          return
        }

        const definition = findVariable(sourceCode.getScope(node), expression.name)?.defs[0]

        if (definition?.type !== 'Variable' || definition.node.id.type !== 'Identifier') {
          return
        }

        const { init } = definition.node

        if (isCreatedFunction(init) && !HANDLER_NAME.test(expression.name)) {
          context.report({ node, messageId: 'handlerName', data: { prop: node.name.name } })
        }

        if (isAlias(init) && !HANDLER_NAME.test(expression.name)) {
          context.report({ node, messageId: 'alias' })
        }
      },
    }
  },
}

export default callbackProps
