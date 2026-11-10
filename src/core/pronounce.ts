/** How Indian names and terms are said by a speech engine. Pure, so the rendering tools can share it. */

/**
 * How Indian names and terms should be *heard*, not seen. English voices read
 * "Dhundh" and "Gathak" as English words; these respellings steer them to
 * something close to the real sound. Only the spoken text is changed.
 */
const SAY_AS: Array<[RegExp, string]> = [
  [/\bDhundh\b/g, 'Dhoondh'],
  [/\bEkarupa\b/g, 'Ekaroopa'],
  [/\bMaitri\b/g, 'Maitree'],
  [/\bGathak\b/g, 'Gaathak'],
  [/\bGatha\b/g, 'Gaatha'],
  [/\bSabha\b/g, 'Sabhaa'],
  [/\bVimana\b/g, 'Vimaana'],
  [/\bPramana\b/g, 'Pramaana'],
  [/\bVidya\b/g, 'Vidyaa'],
  [/\bdhamma\b/gi, 'dhamma'],
  [/\bSulh-i-kul\b/g, 'Sulh-e-kul'],
  [/\bChakravyuha\b/g, 'Chakravyooha'],
  [/\bVibhishana\b/g, 'Vibheeshana'],
  [/\bRavana\b/g, 'Raavana'],
  [/\bRama\b/g, 'Raama'],
  [/\bSita\b/g, 'Seetaa'],
  [/\bAshoka\b/g, 'Ashoka'],
  [/\bKalinga\b/g, 'Kalinga'],
  [/\bMahabharata\b/g, 'Mahaabhaarata'],
  [/\bRamayana\b/g, 'Raamaayana'],
  [/\bUttaramerur\b/g, 'Uttaramerur'],
  [/\bKunjaramallan\b/g, 'Kunjaramallan'],
  [/\bBrahmi\b/g, 'Braahmi'],
  [/\bKharosthi\b/g, 'Kharoshthi'],
  [/\bsulh\b/gi, 'sulh'],
  [/\bjizya\b/g, 'jizya'],
  [/\bStupa\b/gi, 'stoopa'],
  [/\bMeluhha\b/g, 'Meluhha'],
  [/\bShilpa\b/g, 'Shilpa'],
  [/\bBhadra\b/g, 'Bhadraa'],
  [/\bMaratha\b/g, 'Maraathaa'],
  [/\bHampi\b/g, 'Hampee'],
  [/\bKonark\b/g, 'Konaark'],
  [/\bChola\b/g, 'Chola'],
  [/\bVijayanagara\b/g, 'Vijayanagara'],
  [/\bIbadat Khana\b/g, 'Ibaadat Khaana'],
  [/\bTaj\b/g, 'Taaj'],
];

export function pronounceable(text: string): string {
  let out = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s*—\s*/g, ', ').replace(/…/g, '...');
  for (const [pattern, spoken] of SAY_AS) out = out.replace(pattern, spoken);
  return out;
}

