import { parseFrontmatter, generateFrontmatter, stripFrontmatter, cleanTag, cleanTags } from '../src/frontmatter';

describe('parseFrontmatter', () => {
  it('parses YAML frontmatter from markdown', () => {
    const md = `---
title: "Test Article"
type: card
tags:
  - javascript
  - react
---

# Content here`;
    const result = parseFrontmatter(md);
    expect(result.title).toBe('Test Article');
    expect(result.type).toBe('card');
    expect(result.tags).toEqual(['javascript', 'react']);
  });

  it('returns empty object for no frontmatter', () => {
    expect(parseFrontmatter('# Just content')).toEqual({});
  });

  it('handles frontmatter with status field', () => {
    const md = `---
status: raw
source_url: "https://example.com"
---
Content`;
    const result = parseFrontmatter(md);
    expect(result.status).toBe('raw');
    expect(result.source_url).toBe('https://example.com');
  });

  it('handles inline arrays', () => {
    const md = `---
tags: [a, b, c]
---`;
    const result = parseFrontmatter(md);
    expect(result.tags).toEqual(['a', 'b', 'c']);
  });

  it('handles empty arrays', () => {
    const md = `---
tags: []
---`;
    const result = parseFrontmatter(md);
    expect(result.tags).toEqual([]);
  });
});

describe('stripFrontmatter', () => {
  it('removes frontmatter and returns body', () => {
    const md = `---
title: test
---

# Content`;
    expect(stripFrontmatter(md)).toBe('\n\n# Content');
  });

  it('returns full content when no frontmatter', () => {
    expect(stripFrontmatter('# No FM')).toBe('# No FM');
  });
});

describe('generateFrontmatter', () => {
  it('generates valid YAML frontmatter', () => {
    const result = generateFrontmatter({
      title: 'Test',
      type: 'card',
      tags: ['a', 'b'],
    });
    expect(result).toContain('---');
    expect(result).toContain('title: "Test"');
    expect(result).toContain('type: "card"');
    expect(result).toContain('  - a');
    expect(result).toContain('  - b');
  });

  it('handles empty tags array', () => {
    const result = generateFrontmatter({ title: 'X', tags: [] });
    expect(result).toContain('tags: []');
  });

  it('skips null/undefined values', () => {
    const result = generateFrontmatter({ title: 'X', missing: null, undef: undefined });
    expect(result).not.toContain('missing');
    expect(result).not.toContain('undef');
  });
});

describe('cleanTag', () => {
  it('lowercases and trims', () => {
    expect(cleanTag('  JavaScript  ')).toBe('javascript');
  });

  it('replaces spaces with hyphens', () => {
    expect(cleanTag('machine learning')).toBe('machine-learning');
  });

  it('removes special characters', () => {
    expect(cleanTag('C++ & C#')).toBe('c-c');
  });

  it('preserves Chinese characters', () => {
    expect(cleanTag('前端开发')).toBe('前端开发');
  });

  it('limits to 30 chars', () => {
    const long = 'a'.repeat(50);
    expect(cleanTag(long).length).toBe(30);
  });
});

describe('cleanTags', () => {
  it('cleans and deduplicates', () => {
    expect(cleanTags(['JavaScript', 'javascript', 'React'])).toEqual(['javascript', 'react']);
  });

  it('removes empty tags', () => {
    expect(cleanTags(['valid', '', '  '])).toEqual(['valid']);
  });
});
