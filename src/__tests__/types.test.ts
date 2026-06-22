import { describe, it, expect } from 'vitest';
import { BiasRecordSchema, StructuredScriptSchema } from '../types.js';

describe('BiasRecord schema', () => {
  it('accepts a valid unused bias entry', () => {
    const valid = {
      id: 'confirmation-bias',
      name: 'Confirmation Bias',
      one_line_hook: 'Why you only remember when your gut was right',
      source_link: 'https://en.wikipedia.org/wiki/Confirmation_bias',
      used_at: null,
    };
    expect(() => BiasRecordSchema.parse(valid)).not.toThrow();
  });

  it('accepts a used bias entry with ISO timestamp', () => {
    const used = {
      id: 'sunk-cost',
      name: 'Sunk Cost Fallacy',
      one_line_hook: 'Why you finish bad movies',
      source_link: 'https://en.wikipedia.org/wiki/Sunk_cost',
      used_at: '2026-06-22T22:00:00Z',
    };
    expect(() => BiasRecordSchema.parse(used)).not.toThrow();
  });

  it('rejects a record missing the id field', () => {
    const invalid = { name: 'X', one_line_hook: 'Y', source_link: 'Z', used_at: null };
    expect(() => BiasRecordSchema.parse(invalid)).toThrow();
  });
});

describe('StructuredScript schema', () => {
  it('accepts a script with all 6 section kinds in order', () => {
    const script = {
      bias_id: 'confirmation-bias',
      generated_at: '2026-06-22T15:00:00Z',
      title: 'Why you only remember when your gut was right — the Confirmation Bias',
      description: 'A 60-second look at why your brain keeps a one-sided scoreboard.',
      tags: ['psychology', 'cognitive bias', 'confirmation bias'],
      sections: [
        { kind: 'hook', voice: 'You ever notice...', on_screen: 'You ever notice...', broll_query: 'ink water slow motion' },
        { kind: 'phenomenon', voice: '...', on_screen: '...', broll_query: 'smoke abstract dark' },
        { kind: 'bias_name', voice: '...', on_screen: 'Confirmation Bias', broll_query: 'particles floating' },
        { kind: 'mechanism', voice: '...', on_screen: '...', broll_query: 'neurons firing' },
        { kind: 'twist', voice: '...', on_screen: '...', broll_query: 'liquid metal flowing' },
        { kind: 'loop_bait', voice: '...', on_screen: '...', broll_query: 'ink swirl dark' },
      ],
    };
    expect(() => StructuredScriptSchema.parse(script)).not.toThrow();
  });

  it('rejects a script with the wrong number of sections', () => {
    const tooFew = {
      bias_id: 'x', generated_at: '2026-06-22T00:00:00Z',
      title: 'x', description: 'x', tags: [],
      sections: [{ kind: 'hook', voice: 'x', on_screen: 'x', broll_query: 'x' }],
    };
    expect(() => StructuredScriptSchema.parse(tooFew)).toThrow();
  });
});
