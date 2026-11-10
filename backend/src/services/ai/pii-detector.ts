export type PiiType =
  | 'EMAIL'
  | 'PHONE'
  | 'ROLL_NUMBER'
  | 'URL'
  | 'SOCIAL_HANDLE'
  | 'SELF_IDENTIFICATION'
  | 'NAME'
  | 'OTHER';

export interface PiiFinding {
  type: PiiType;
  excerpt: string;
  message: string;
  source: 'PATTERN' | 'AI';
}

interface Rule {
  type: PiiType;
  pattern: RegExp;
  message: string;
}

const RULES: Rule[] = [
  {
    type: 'EMAIL',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    message: 'Looks like an email address.',
  },
  {
    type: 'PHONE',
    pattern:
      /(?<![\w])(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,5}[\s.-]?\d{3,4}[\s.-]?\d{0,4}(?![\w])/g,
    message: 'Looks like a phone number.',
  },
  {
    type: 'ROLL_NUMBER',
    pattern: /\b(?:[A-Za-z]{0,4}\d{2,4}[-/]?[A-Za-z]{1,5}[-/]?\d{2,8}|[A-Za-z]{2,4}\d{8,13})\b/g,
    message: 'Looks like a roll or registration number.',
  },
  {
    type: 'SELF_IDENTIFICATION',
    pattern: /\b(?:[Mm]y name is|I am called|I'm|I am)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g,
    message: 'Looks like you are introducing yourself by name.',
  },
  {
    type: 'SELF_IDENTIFICATION',
    pattern:
      /\b(?:my\s+)?(?:roll|reg(?:istration)?|enrol?ment|student)\s*(?:no\.?|number|id|#)\s*(?:is\s*)?[:-]?\s*[A-Za-z0-9/-]+/gi,
    message: 'Looks like you are sharing an identification number.',
  },
  {
    type: 'SOCIAL_HANDLE',
    pattern:
      /(?<![\w@])@[A-Za-z0-9_]{3,30}\b|\b(?:instagram|insta|linkedin|github|twitter|snapchat|discord)\s*(?:id|handle|profile)?\s*[:-]?\s*[A-Za-z0-9_.]{3,}/gi,
    message: 'Looks like a social media handle.',
  },
  {
    type: 'URL',
    pattern:
      /\bhttps?:\/\/(?:www\.)?(?:linkedin\.com|github\.com|instagram\.com|facebook\.com|x\.com|twitter\.com)\/[^\s]+/gi,
    message: 'Links to a personal profile.',
  },
];

function isLikelyPhone(match: string): boolean {
  const digits = match.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function maskValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '•'.repeat(trimmed.length);
  const visible = Math.min(3, Math.floor(trimmed.length / 4));
  return `${trimmed.slice(0, visible)}${'•'.repeat(Math.max(3, trimmed.length - visible * 2))}${trimmed.slice(-visible)}`;
}

interface Match {
  type: PiiType;
  start: number;
  end: number;
  value: string;
  message: string;
}

function findMatches(text: string): Match[] {
  const matches: Match[] = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.pattern)) {
      const value = m[0].replace(/[\s.-]+$/, '');
      if (rule.type === 'PHONE' && !isLikelyPhone(value)) continue;
      const start = m.index ?? 0;
      matches.push({
        type: rule.type,
        start,
        end: start + value.length,
        value,
        message: rule.message,
      });
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Match[] = [];
  for (const m of matches) {
    const last = kept[kept.length - 1];
    if (!last || m.start >= last.end) kept.push(m);
  }
  return kept;
}

export function detectPersonalInformation(text: string): PiiFinding[] {
  const seen = new Set<string>();
  const findings: PiiFinding[] = [];
  for (const m of findMatches(text)) {
    const key = `${m.type}:${m.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      type: m.type,
      excerpt: maskValue(m.value),
      message: m.message,
      source: 'PATTERN',
    });
  }
  return findings;
}

export function redactPersonalInformation(text: string): string {
  const matches = findMatches(text);
  let result = '';
  let cursor = 0;
  for (const m of matches) {
    result += `${text.slice(cursor, m.start)}[REDACTED_${m.type}]`;
    cursor = m.end;
  }
  return result + text.slice(cursor);
}
