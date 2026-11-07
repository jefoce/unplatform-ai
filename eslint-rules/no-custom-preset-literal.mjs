const CUSTOM_PREFIX = 'custom.'

const noCustomPresetLiteral = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      literal: 'Use isCustomPresetId from src/core/presets/custom.',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === 'string' && node.value.startsWith(CUSTOM_PREFIX)) {
          context.report({ node, messageId: 'literal' })
        }
      },
    }
  },
}

export default noCustomPresetLiteral
