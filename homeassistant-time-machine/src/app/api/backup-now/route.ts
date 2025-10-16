
import { NextResponse } from 'next/server';
import { createBackup } from '../backup-utils';

export async function POST(request: Request) {
  try {
    const { liveFolderPath, backupFolderPath, timezone } = await request.json();

    if (!liveFolderPath || !backupFolderPath || !timezone) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const { backupDir } = await createBackup(liveFolderPath, backupFolderPath, timezone);

    return NextResponse.json({ message: `Backup created successfully at ${backupDir}` });
  } catch (error) {
    console.error('Failed to create backup:', error);
    return NextResponse.json({ error: 'Failed to create backup.' }, { status: 500 });
  }
}
