/**
 * Frontmatter 解析和生成工具
 * 轻量实现，不依赖 yaml 库
 */

export function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: Record<string, any> = {};
  let currentKey = '';
  let inArray = false;
  let arrayValues: string[] = [];

  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();

    // Array item
    if (inArray && trimmed.startsWith('- ')) {
      arrayValues.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // Close array if we were in one
    if (inArray) {
      result[currentKey] = arrayValues;
      inArray = false;
      arrayValues = [];
    }

    // Key: value pair
    const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    const value = kvMatch[2].trim();

    // Inline empty array
    if (value === '[]') {
      result[key] = [];
      continue;
    }

    // Start of array (value is empty, items follow)
    if (value === '') {
      currentKey = key;
      inArray = true;
      arrayValues = [];
      continue;
    }

    // Inline array: [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      result[key] = value.slice(1, -1).split(',').map(s =>
        s.trim().replace(/^["']|["']$/g, '')
      );
      continue;
    }

    // String value (strip quotes)
    result[key] = value.replace(/^["']|["']$/g, '');
  }

  // Close trailing array
  if (inArray) {
    result[currentKey] = arrayValues;
  }

  return result;
}

export function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
}

export function generateFrontmatter(fields: Record<string, any>): string {
  const lines: string[] = ['---'];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${item}`);
        }
      }
    } else if (typeof value === 'string') {
      // Quote strings that contain special chars
      if (value.includes(':') || value.includes('#') || value.includes('"') || value.includes("'")) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: "${value}"`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * 清洗标签：小写，空格→连字符，去特殊字符，限长
 */
export function cleanTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff\-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

/**
 * 清洗标签列表并去重
 */
export function cleanTags(tags: string[]): string[] {
  const cleaned = tags.map(cleanTag).filter(t => t.length > 0);
  return [...new Set(cleaned)];
}
