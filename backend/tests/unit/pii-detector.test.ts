import { describe, expect, it } from 'vitest';
import {
  detectPersonalInformation,
  maskValue,
  redactPersonalInformation,
} from '../../src/services/ai/pii-detector.js';

const types = (text: string) => detectPersonalInformation(text).map((f) => f.type);

describe('deterministic personal-information detector', () => {
  it.each([
    ['email', 'Mail me at priya.sharma@college.edu for notes', 'EMAIL'],
    ['Indian mobile', 'WhatsApp +91 98765 43210 if you know', 'PHONE'],
    ['US phone', 'call (555) 123-4567 tonight', 'PHONE'],
    ['plain 10-digit', 'my number 9876543210', 'PHONE'],
    ['roll number', 'I am stuck, roll 21CS1043 here', 'ROLL_NUMBER'],
    ['registration number', 'RA2111003010123 is my id', 'ROLL_NUMBER'],
    ['self introduction', 'Hi, I am Rahul and I need help', 'SELF_IDENTIFICATION'],
    ['my name is', 'my name is Ananya Iyer', 'SELF_IDENTIFICATION'],
    ['labelled roll no', 'Roll no: 42 from section B', 'SELF_IDENTIFICATION'],
    ['social handle', 'DM me on instagram: priya_codes', 'SOCIAL_HANDLE'],
    ['at handle', 'ping @priya_dev', 'SOCIAL_HANDLE'],
    ['profile url', 'see https://www.linkedin.com/in/priya-sharma', 'URL'],
  ])('detects %s', (_label, text, expected) => {
    expect(types(text)).toContain(expected);
  });

  it.each([
    'Explain 2NF and 3NF with an example.',
    'I am confused about Dijkstra’s algorithm complexity O(E log V).',
    'Why does IPv4 use 32-bit addresses while IPv6 uses 128?',
    'What is the difference between SHA256 and MD5?',
    'In CS202 we covered B+ trees on page 345.',
    'Compute 2^10 = 1024 and explain base cases.',
    'The year 2024 had 366 days.',
  ])('does not flag ordinary academic text: %s', (text) => {
    expect(detectPersonalInformation(text)).toEqual([]);
  });

  it('masks detected values instead of echoing them', () => {
    const [finding] = detectPersonalInformation('Email priya.sharma@college.edu');
    expect(finding!.excerpt).not.toBe('priya.sharma@college.edu');
    expect(finding!.excerpt).toContain('•');
    expect(maskValue('abc')).toBe('•••');
  });

  it('does not include trailing punctuation in a match', () => {
    const redacted = redactPersonalInformation('Call me on 9876543210. Thanks!');
    expect(redacted).toBe('Call me on [REDACTED_PHONE]. Thanks!');
  });

  it('does not double report a phone number embedded in an email', () => {
    expect(types('9876543210@college.edu')).toEqual(['EMAIL']);
  });

  it('redacts identifiers before text is sent to the AI provider', () => {
    const redacted = redactPersonalInformation(
      'I am Rahul, mail rahul@x.com or call 9876543210 about joins',
    );
    expect(redacted).not.toContain('rahul@x.com');
    expect(redacted).not.toContain('9876543210');
    expect(redacted).not.toContain('Rahul');
    expect(redacted).toContain('[REDACTED_EMAIL]');
    expect(redacted).toContain('about joins');
  });
});
