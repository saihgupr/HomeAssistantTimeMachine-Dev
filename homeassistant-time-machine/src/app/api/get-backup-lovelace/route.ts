
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { backupPath } = await request.json();

    if (!backupPath) {
      return NextResponse.json({ error: 'backupPath is required' }, { status: 400 });
    }

    // Basic security check
    if (backupPath.includes('..')) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const storagePath = path.join(backupPath, '.storage');
    const files = await fs.readdir(storagePath);

    return NextResponse.json({ lovelaceFiles: files });

  } catch (error: unknown) {
    const err = error as Error & { code?: string; path?: string };
    if (err.code === 'ENOENT') {
        return NextResponse.json({ error: `.storage directory not found in the specified backup.` }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to read .storage directory.', details: err.message }, { status: 500 });
  }
}
