/** One interface language: its strings, keyed by the English they replace. */
export interface LangPack {
  /** Whole strings: English → translation. */
  exact: Record<string, string>;
  /** One template per pattern in hi.ts (same order), with $1…$n for the captured parts. */
  templates: string[];
  /** Region names: the zone's English name → its name in this language. */
  regions: Record<string, string>;
  /** Text that sits between tags in a few templated lines, such as "Question <b>3</b> of <b>5</b>". */
  fragments: Record<string, string>;
}
