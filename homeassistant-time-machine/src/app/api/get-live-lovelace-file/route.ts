
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export async function POST(request: Request) {
  try {
    const { liveConfigPath, fileName } = await request.json();

    if (!liveConfigPath || !fileName) {
      return NextResponse.json({ error: 'liveConfigPath and fileName are required' }, { status: 400 });
    }

    // Basic security check
    if (liveConfigPath.includes('..') || fileName.includes('..')) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const filePath = path.join(liveConfigPath, '.storage', fileName);
    const fileContent = await fs.readFile(filePath, 'utf8');

    // Parse and re-serialize YAML to normalize content for comparison
    const parsedContent = yaml.load(fileContent);
    const normalizedContent = yaml.dump(parsedContent, { noRefs: true, sortKeys: true });

    return NextResponse.json({ content: normalizedContent });

  } catch (error: unknown) {
    const err = error as Error & { code?: string; path?: string };
    if (err.code === 'ENOENT') {
        return NextResponse.json({ error: `File not found in the live config.` }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to read file.', details: err.message }, { status: 500 });
  }
}
