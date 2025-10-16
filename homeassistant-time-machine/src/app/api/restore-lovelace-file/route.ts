
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { liveConfigPath, fileName, content } = await request.json();

    if (!liveConfigPath || !fileName || !content) {
      return NextResponse.json({ error: 'liveConfigPath, fileName, and content are required' }, { status: 400 });
    }

    // Basic security check
    if (liveConfigPath.includes('..') || fileName.includes('..')) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const filePath = path.join(liveConfigPath, '.storage', fileName);
    await fs.writeFile(filePath, content, 'utf8');

    return NextResponse.json({ message: 'File restored successfully' });

  } catch (error: unknown) {
    const err = error as Error & { code?: string; path?: string };
    console.error(err);
    return NextResponse.json({ error: 'Failed to restore file.', details: err.message }, { status: 500 });
  }
}
