type ErrorKind =
  | 'content'
  | 'copyright'
  | 'real_person'
  | 'input'
  | 'busy'
  | 'provider'
  | 'account'
  | 'app'
  | 'unknown'

export interface FriendlyError {
  title: string
  hint?: string
  kind: ErrorKind
  retry: boolean
  raw: string
}

type Text = string | ((raw: string) => string)

type Matcher = string | RegExp | ((raw: string) => boolean)

export interface Rule {
  match: Matcher
  title: Text
  hint?: Text
  kind: ErrorKind
  retry?: boolean
}

export type HttpRule = Omit<Rule, 'match'>

export type HttpRuleTable = Readonly<Partial<Record<number, HttpRule>>>
