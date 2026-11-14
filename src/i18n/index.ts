/**
 * Interface language.
 *
 * The interface is built in many places, in English. Rather than thread a translation call through every one of
 * them, a watcher swaps any text node (and a few attributes) whose text is a known interface string for its
 * Hindi, as the page is built and as it changes. History content (codex text, questions, dialogue) is not in the
 * dictionary and stays in English.
 *
 * The choice lives in the save's settings; changing it reloads the page so everything is drawn fresh.
 */

import type { Zone } from '../content/types';
import { ZONES } from '../content/zones';
import { save } from '../core/Save';
import { EXACT, PATTERNS } from './hi';

export type Lang = 'en' | 'hi';

export function currentLang(): Lang {
  return save.settings.lang === 'hi' ? 'hi' : 'en';
}

/** A region's name for the interface: its Devanagari name in Hindi (the first one, where it has two). */
export function zoneLabel(zone: Pick<Zone, 'name' | 'nameLocal'>): string {
  if (currentLang() !== 'hi') return zone.name;
  return (zone.nameLocal.split(' · ')[0] ?? zone.name).trim();
}

const ZONE_NAMES = new Map<string, string>();
function zoneNames(): Map<string, string> {
  if (ZONE_NAMES.size === 0) for (const z of ZONES) ZONE_NAMES.set(z.name, (z.nameLocal.split(' · ')[0] ?? z.name).trim());
  return ZONE_NAMES;
}

/** Text that sits between tags in a few templated lines (for example "Question <b>3</b> of <b>5</b>"). */
const FRAGMENTS: Record<string, string> = {
  Question: 'प्रश्न',
  of: '/',
  'to steer ·': 'से दिशा ·',
  'for the canopy ·': 'से छतरी ·',
  Gliding: 'ग्लाइड',
  'turn ·': 'मुड़ें ·',
  flare: 'धीमा',
  'Swimming ·': 'तैर रहे हैं ·',
  'to surface': 'से ऊपर आएँ',
};

function translatePart(s: string): string {
  return EXACT[s] ?? zoneNames().get(s) ?? s;
}

/** Translate one string; returns it unchanged when there is no Hindi for it. */
export function translate(text: string): string {
  const t = text.trim();
  if (!t || !/[A-Za-z]/.test(t)) return text;
  let out = EXACT[t] ?? zoneNames().get(t) ?? FRAGMENTS[t];
  if (out === undefined) {
    for (const [re, tpl] of PATTERNS) {
      const m = t.match(re);
      if (!m) continue;
      out = tpl.replace(/\$(\d)/g, (_, i: string) => translatePart(m[Number(i)] ?? ''));
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
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v) {
      const t = translate(v);
      if (t !== v) el.setAttribute(a, t);
    }
  }
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) translateNode(n);
    else {
      const e = n as Element;
      for (const a of ATTRS) {
        const v = e.getAttribute(a);
        if (v) {
          const t = translate(v);
          if (t !== v) e.setAttribute(a, t);
        }
      }
    }
    n = walker.nextNode();
  }
}

let started = false;

/** Start translating the page into Hindi, if that is the chosen language. */
export function startI18n(): void {
  if (started || currentLang() !== 'hi') return;
  started = true;
  document.documentElement.lang = 'hi';
  document.documentElement.classList.add('lang-hi');
  document.title = translate(document.title);
  translateNode(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') translateNode(r.target);
      else if (r.type === 'attributes') translateNode(r.target);
      else for (const n of r.addedNodes) translateNode(n);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/** Switch language and redraw everything in it. */
export function setLang(lang: Lang): void {
  save.patchSettings({ lang });
  save.flush();
  location.reload();
}
