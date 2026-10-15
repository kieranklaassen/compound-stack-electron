// Every tool call goes through `runTool`, which checks the arguments against
// the tool's schema, runs it and writes it in the call log. Never call a tool's
// `run` yourself: a call that is not in the log did not happen as far as the
// person can tell.

import { Sentence } from '../feedback/sentence'
import { createStore } from '../store'

export interface Schema {
  type: 'object'
  properties: Record<string, { type: 'string' | 'number' | 'boolean'; enum?: readonly unknown[]; description?: string }>
  required?: readonly string[]
  additionalProperties: false
}

export interface Tool {
  name: string
  description: string
  schema: Schema
  /** True when the tool never changes anything. */
  readOnly?: boolean
  run(args: Record<string, unknown>, context: { by: string }): Promise<unknown> | unknown
}

export interface Call {
  at: number
  by: string
  tool: string
  args: Record<string, unknown>
  ok: boolean
  /** A refusal's sentence, or what was answered, cut to a length a log can keep. */
  result: string
}

export const LOG_MOST = 200
export const callLog = createStore<Call[]>([])

export type Result = { ok: true; value: unknown } | { ok: false; refused: string }

/** What is wrong with `args` for a schema, as a sentence, or null. */
export function argsIssue(schema: Schema, args: unknown): string | null {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return 'The arguments are an object.'
  const given = args as Record<string, unknown>
  for (const key of Object.keys(given)) if (!Object.hasOwn(schema.properties, key)) return `There is no argument “${key}”.`
  for (const key of schema.required ?? []) if (!(key in given)) return `The argument “${key}” is needed.`
  for (const [key, value] of Object.entries(given)) {
    const property = schema.properties[key]!
    if (typeof value !== property.type) return `The argument “${key}” is a ${property.type}.`
    if (property.enum && !property.enum.includes(value)) return `The argument “${key}” is one of: ${property.enum.join(', ')}.`
  }
  return null
}

export async function runTool(tools: readonly Tool[], name: string, args: unknown, by = 'agent'): Promise<Result> {
  const tool = tools.find((found) => found.name === name)
  let result: Result
  if (!tool) result = { ok: false, refused: `There is no tool “${name}”.` }
  else {
    const issue = argsIssue(tool.schema, args ?? {})
    if (issue) result = { ok: false, refused: issue }
    else {
      try {
        result = { ok: true, value: (await tool.run((args ?? {}) as Record<string, unknown>, { by })) ?? null }
      } catch (error) {
        // A tool that broke says only that it failed: an error's own words may hold what must not be shown.
        result = { ok: false, refused: error instanceof Sentence ? error.message : `${name} failed.` }
      }
    }
  }
  const call: Call = {
    at: Date.now(),
    by,
    tool: name,
    args: args !== null && typeof args === 'object' ? (args as Record<string, unknown>) : {},
    ok: result.ok,
    result: (result.ok ? JSON.stringify(result.value) : result.refused).slice(0, 400),
  }
  callLog.set((log) => [...log.slice(-(LOG_MOST - 1)), call])
  return result
}
