const PRESET_IDS = /^(wan-3\.0|wan-3\.0-prime|seedance-2\.0|seedance-2\.5)$/

export const restrict = (...groups) => ['error', ...groups.flat()]

export const BRANCH_TYPES =
  '/^(JSXElement|JSXFragment|CallExpression|NewExpression|AwaitExpression|ArrowFunctionExpression|FunctionExpression|ObjectExpression|ArrayExpression|ConditionalExpression|LogicalExpression|AssignmentExpression|SequenceExpression|TaggedTemplateExpression|SpreadElement)$/'

export const TEST_TYPES =
  '/^(CallExpression|NewExpression|AwaitExpression|LogicalExpression|ConditionalExpression|AssignmentExpression|SequenceExpression)$/'

export const TERNARY_SELECTORS = [
  {
    selector: 'ConditionalExpression:not(VariableDeclarator > ConditionalExpression)',
    message: 'Ternaries only as a const value: const label = isOpen ? "Close" : "Open".',
  },
  {
    selector: `ConditionalExpression[consequent.type=${BRANCH_TYPES}], ConditionalExpression[alternate.type=${BRANCH_TYPES}]`,
    message:
      'Ternary branches are plain values. Render components with && or an early return, compute values in their own const.',
  },
  {
    selector: `ConditionalExpression[test.type=${TEST_TYPES}]`,
    message: 'Ternary condition is one simple check. Name it first: const isReady = a && b.',
  },
]

// Shared so the secrets, route and component blocks keep these checks.
export const SHARED_SELECTORS = [
  {
    selector: "BinaryExpression[operator=/^[!=]==?$/] > Literal[raw='null']",
    message: 'Use isNil() / !isNil() from lodash-es.',
  },
  {
    selector: "BinaryExpression[operator=/^[!=]==?$/] > Identifier[name='undefined']",
    message: 'Use isNil() / !isNil() from lodash-es.',
  },
  {
    selector:
      "BinaryExpression[operator=/^[!=]==?$/][left.type='UnaryExpression'][left.operator='typeof'] > Literal[value=/^(string|boolean|function)$/]",
    message: 'Use isString / isBoolean / isFunction from lodash-es.',
  },
  {
    selector:
      "CallExpression[callee.property.name='finally'] > ArrowFunctionExpression > BlockStatement > ReturnStatement[argument]",
    message: 'A finally callback returns nothing. Drop the return.',
  },
  {
    selector:
      'ArrowFunctionExpression > BlockStatement > ReturnStatement > CallExpression[callee.name=/^(set|setState)$/]',
    message: 'set returns nothing. Call it as a statement.',
  },
  {
    selector: 'TSEnumDeclaration',
    message: 'No enum. Use an as const array and a derived union.',
  },
  ...TERNARY_SELECTORS,
]

// One exported literal union per as const array, scoped in eslint.config.mjs.
export const UNION_SELECTORS = [
  {
    selector:
      "ExportNamedDeclaration > TSTypeAliasDeclaration > TSUnionType[types.0.type='TSLiteralType'][types.1.type='TSLiteralType']",
    message: 'Derive shared unions from an as const array: (typeof LIST)[number].',
  },
]

export const MODULE_SELECTORS = [
  {
    selector: 'ExportAllDeclaration, ExportNamedDeclaration[source]',
    message: 'No re-exports. Import from the module that defines it.',
  },
]

export const SERVER_SELECTORS = [
  {
    selector: 'ImportExpression',
    message: 'No dynamic imports in server code. Wire dependencies in src/server/boot.ts.',
  },
]

export const PROPS_SELECTOR = {
  selector:
    'FunctionDeclaration > ObjectPattern, VariableDeclarator > ArrowFunctionExpression > ObjectPattern',
  message: 'Take props or params, then destructure on the first line of the body.',
}

export const SECRET_SELECTORS = [
  {
    selector:
      "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^(OPENROUTER_(?!MOCK$)|R2_)/]",
    message: 'Read secret values through src/server/secrets, not process.env.',
  },
  {
    selector: `Literal[value=${PRESET_IDS}]`,
    message: 'Preset ids live in src/core/presets.',
  },
  {
    selector: 'Literal[value=/^(alibaba|bytedance)\\//]',
    message: 'Preset slugs live in src/core/presets.',
  },
]

export const OBJECT_FUNCTION_SELECTOR = {
  selector: 'ObjectExpression > Property > :matches(ArrowFunctionExpression, FunctionExpression)',
  message: 'Name the function (handle<Action>) and pass it by reference.',
}

export const INLINE_FUNCTION_SELECTORS = [
  {
    selector:
      "JSXAttribute > JSXExpressionContainer > :matches(ArrowFunctionExpression, FunctionExpression), JSXAttribute > JSXExpressionContainer > CallExpression[callee.property.name='bind']",
    message: 'No inline functions in JSX. Define handle<Action> above the return.',
  },
]

// One level per object type. Bigger shapes are built from named parts.
export const TYPE_SELECTORS = [
  {
    selector: 'TSTypeLiteral',
    message: 'Name this object type: declare an interface and reference it.',
  },
  {
    selector: "TSTypeReference[typeName.name='Record'] TSTypeReference[typeName.name='Record']",
    message: 'Name the inner map type: type SizeByAspect = Partial<Record<...>>.',
  },
  {
    selector:
      "CallExpression[callee.object.name='z'] CallExpression[callee.object.name='z'][callee.property.name='object']",
    message: 'Name the inner schema (FooSchema) and reference it.',
  },
  {
    selector:
      "TSIndexedAccessType:not(TSTypeAliasDeclaration > TSIndexedAccessType):not([indexType.type='TSNumberKeyword'])",
    message: 'Use the named part type (RecordJob, PresetIcon) instead of X["key"].',
  },
  {
    selector:
      "TSTypeReference[typeName.name='ReturnType']:not(TSTypeAliasDeclaration > TSTypeReference)",
    message: 'Name it once: type IntervalId = ReturnType<typeof setInterval>.',
  },
  {
    selector:
      "TSTypeAliasDeclaration[typeAnnotation.type='TSTypeReference']:not([typeAnnotation.typeArguments])",
    message: 'No pure type aliases. Import the original type.',
  },
]
