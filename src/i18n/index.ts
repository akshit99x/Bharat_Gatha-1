/**
 * Interface language.
 *
 * The interface is built in many places, in English. Rather than thread a translation call through every one of
 * them, a watcher swaps any text node (and a few attributes) whose text is a known interface string for its
 * translation, as the page is built and as it changes. History content (codex text, questions, dialogue) is not in
 * the dictionaries and stays in English.
 *
 * Every language uses the same English keys and the same patterns (the regular expressions live in hi.ts); each
 * one supplies its own strings and pattern templates. The choice lives in the save's settings; changing it reloads
 * the page so everything is drawn fresh.
 */

import type { Zone } from '../content/types';
import { save } from '../core/Save';
import { PATTERNS } from './hi';
import type { LangPack } from './pack';
import { PACKS } from './packs';

export type Lang = 'en' | 'hi' | 'bn' | 'mr' | 'ta';

/** The languages on offer, each named in its own script (and in English, for the tooltip). */
export const LANGS: ReadonlyArray<{ code: Lang; label: string; english: string }> = [
  { code: 'en', label: 'English', english: 'English' },
  { code: 'hi', label: 'हिन्दी', english: 'Hindi' },
  { code: 'bn', label: 'বাংলা', english: 'Bengali' },
  { code: 'mr', label: 'मराठी', english: 'Marathi' },
  { code: 'ta', label: 'தமிழ்', english: 'Tamil' },
];

const PATTERN_RES = PATTERNS.map(([re]) => re);

export function currentLang(): Lang {
  const l = save.settings.lang;
  return LANGS.some((x) => x.code === l) ? l : 'en';
}

function pack(): LangPack | null {
  const l = currentLang();
  return l === 'en' ? null : PACKS[l];
}

/** A region's name in the interface language. */
export function zoneLabel(zone: Pick<Zone, 'name' | 'nameLocal'>): string {
  return pack()?.regions[zone.name] ?? zone.name;
}

function translatePart(p: LangPack, s: string): string {
  return p.exact[s] ?? p.regions[s] ?? s;
}

/** Translate one string; returns it unchanged when there is no translation for it. */
export function translate(text: string): string {
  const p = pack();
  if (!p) return text;
  const t = text.trim();
  if (!t || !/[A-Za-z]/.test(t)) return text;
  let out = p.exact[t] ?? p.regions[t] ?? p.fragments[t];
  if (out === undefined) {
    for (let i = 0; i < PATTERN_RES.length; i++) {
      const m = t.match(PATTERN_RES[i]!);
      if (!m) continue;
      out = (p.templates[i] ?? '').replace(/\$(\d)/g, (_, n: string) => translatePart(p, m[Number(n)] ?? ''));
      break;
    }
  }
  if (out === undefined) return text;
  // Keep the surrounding whitespace, so text joined to bold numbers still reads.
  const lead = text.match(/^\s*/)?.[0] ?? '';
  const trail = text.match(/\s*$/)?.[0] ?? '';
  return lead + out + trail;
}

const ATTRS = ['placeholder', 'title', 'aria-label'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);

function translateAttrs(el: Element): void {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v) {
      const t = translate(v);
      if (t !== v) el.setAttribute(a, t);
    }
  }
}

function translateNode(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || SKIP.has(parent.tagName) || parent.closest('[data-no-i18n]')) return;
    const before = node.nodeValue ?? '';
    const after = translate(before);
    if (after !== before) node.nodeValue = after;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (SKIP.has(el.tagName) || el.closest('[data-no-i18n]')) return;
  translateAttrs(el);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) translateNode(n);
    else if (!(n as Element).closest('[data-no-i18n]')) translateAttrs(n as Element);
    n = walker.nextNode();
  }
}

let started = false;

/** Start translating the page, if a language other than English is chosen. */
export function startI18n(): void {
  const lang = currentLang();
  if (started || lang === 'en') return;
  started = true;
  document.documentElement.lang = lang;
  document.documentElement.classList.add('lang-' + lang, 'lang-indic');
  document.title = translate(document.title);
  translateNode(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData' || r.type === 'attributes') translateNode(r.target);
      else for (const n of r.addedNodes) translateNode(n);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/** Switch language and redraw everything in it. */
export function setLang(lang: Lang): void {
  if (lang === currentLang()) return;
  save.patchSettings({ lang });
  save.flush();
  location.reload();
}

/**
 * A row of language buttons, each named in its own script. Used in the pause menu and, as a pop-up, on the title
 * screen. Choosing one reloads the page in that language (progress is saved first).
 */
export function languagePicker(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'lang-picker';
  row.setAttribute('role', 'group');
  row.setAttribute('data-no-i18n', '');
  row.setAttribute('aria-label', 'Language · भाषा');
  const now = currentLang();
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lang-opt';
    b.lang = l.code;
    b.textContent = l.label;
    b.title = l.english;
    b.setAttribute('aria-pressed', String(l.code === now));
    b.addEventListener('click', () => setLang(l.code));
    row.appendChild(b);
  }
  return row;
}
