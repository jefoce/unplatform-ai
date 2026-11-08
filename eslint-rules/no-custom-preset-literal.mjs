const CUSTOM_PREFIX = 'custom.'

const noCustomPresetLiteral = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      literal: 'Use isCustomPresetId or customPresetPrefix from src/core/presets/custom.',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === 'string' && node.value.startsWith(CUSTOM_PREFIX)) {
          context.report({ node, messageId: 'literal' })
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          if (
            typeof quasi.value.cooked === 'string' &&
            quasi.value.cooked.includes(CUSTOM_PREFIX)
          ) {
            context.report({ node: quasi, messageId: 'literal' })
          }
        }
      },
    }
  },
}

export default noCustomPresetLiteral
