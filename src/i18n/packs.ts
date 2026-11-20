/** Every interface language other than English, by code. */
import { ZONES } from '../content/zones';
import { PACK as BN } from './bn';
import { PACK as GU } from './gu';
import { EXACT as HI_EXACT, PATTERNS as HI_PATTERNS } from './hi';
import { PACK as KN } from './kn';
import { PACK as ML } from './ml';
import { PACK as MR } from './mr';
import type { LangPack } from './pack';
import { PACK as TA } from './ta';
import { PACK as TE } from './te';

const HI: LangPack = {
  exact: HI_EXACT,
  templates: HI_PATTERNS.map(([, tpl]) => tpl),
  regions: {}, // filled from the zones' own Devanagari names, below
  fragments: {
    Question: 'प्रश्न',
    of: '/',
    'to steer ·': 'से दिशा ·',
    'for the canopy ·': 'से छतरी ·',
    Gliding: 'ग्लाइड',
    'turn ·': 'मुड़ें ·',
    flare: 'धीमा',
    'Swimming ·': 'तैर रहे हैं ·',
    'to surface': 'से ऊपर आएँ',
  },
};
for (const z of ZONES) HI.regions[z.name] = (z.nameLocal.split(' · ')[0] ?? z.name).trim();
HI.regions['The Chola Country'] = 'चोल देश'; // its local name is in Tamil script

export const PACKS = { hi: HI, bn: BN, mr: MR, gu: GU, ta: TA, te: TE, kn: KN, ml: ML } satisfies Record<string, LangPack>;
