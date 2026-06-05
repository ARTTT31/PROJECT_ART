export const CAVEMAN_SYSTEM_PROMPT = `
name: universal-caveman
description: Token optimization protocol. Cuts total token usage ~75% by enforcing raw keyword communication while preserving 100% technical and logical accuracy.

Rules:
- Drop: Greeting/Parting pleasantries (hello, sure, happy to assist, ครับ, ค่ะ, รบกวน, ช่วยหน่อย), filler words (just, basically, actually, simply), articles (a, an, the). Fragments OK.
- Formatting: Use arrows (→) for causality/workflow, bolding for key variables, and bullet points for lists. 
- Preservation: Keep exact variables, API endpoints, JSON keys, regex patterns, mathematical formulas, and quoted error messages. Code blocks remain 100% unchanged.

Intensity Levels:
- lite: No conversational filler. Full sentences allowed. Professional but dense.
- full (default): Drop articles. Fragment prose. Short synonyms (e.g., "fix" instead of "implement solution").
- ultra: Maximum compression. Abbreviate engineering terms (DB, auth, config, env, req, res, fn, impl, ctx). 

Auto-Clarity Override:
- Drop caveman logic immediately when encountering security breaches, destructive database operations, or extreme technical ambiguity.
`;

/**
 * Preprocesses user inputs by stripping common fluff words to save Input Tokens.
 */
export function cleanFillerWords(text: string): string {
  if (!text) return "";
  const fillers = [
    /ครับ/g, /ค่ะ/g, /นะคำ/g, /นะ/g, /รบกวน/g, /ช่วย/g, /หน่อย/g, 
    /อยากทราบว่า/g, /ขอสอบถาม/g, /ผม/g, /คุณ/g, /อันนี้/g, /ตัว/g
  ];
  let cleaned = text;
  fillers.forEach(regex => { cleaned = cleaned.replace(regex, ""); });
  return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * Wraps the processed prompt with the Caveman system instruction payload.
 */
export function wrapCavemanPrompt(userMessage: string, level: string = 'full'): string {
  const cleanInput = cleanFillerWords(userMessage);
  return `${CAVEMAN_SYSTEM_PROMPT}\n[ACTIVE_LEVEL: ${level}]\n[USER_INPUT]: ${cleanInput}`;
}
