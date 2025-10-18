
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

interface Automation {
    id?: string;
    alias?: string;
    description?: string;
    trigger: any[];
    condition?: any[];
    action: any[];
    mode?: string;
}

export async function POST(request: Request) {
  let mode: string = '';
  try {
    let liveConfigPath: string;
    const body = await request.json();
    const { itemIdentifiers, mode: parsedMode } = body;
    mode = parsedMode;

    if (process.env.LIVE_CONFIG_PATH) {
      liveConfigPath = process.env.LIVE_CONFIG_PATH;
    } else {
      liveConfigPath = body.liveConfigPath;
    }

    if (!liveConfigPath || !itemIdentifiers || !mode) {
      return NextResponse.json({ error: 'liveConfigPath, itemIdentifiers, and mode are required' }, { status: 400 });
    }

    if (liveConfigPath.includes('..')) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const liveItemsMap: Record<string, any> = {};

    if (mode === 'automations') {
      const configFileName = 'automations.yaml';
      const configPath = path.join(liveConfigPath, configFileName);
      const fileContent = await fs.readFile(configPath, 'utf8');
      const items = yaml.load(fileContent) as Automation[] | Record<string, Omit<Automation, 'id'>>;

      if (Array.isArray(items)) {
          for (const id of itemIdentifiers) {
              const liveItem = items.find(item => item.id === id || item.alias === id);
              if (liveItem) {
                  liveItemsMap[id] = liveItem;
              }
          }
      } else {
          return NextResponse.json({ error: `${configFileName} is not in the expected format.` }, { status: 500 });
      }
    } else if (mode === 'scripts') {
      const configFileName = 'scripts.yaml';
      const configPath = path.join(liveConfigPath, configFileName);
      const fileContent = await fs.readFile(configPath, 'utf8');
      const items = yaml.load(fileContent) as Automation[] | Record<string, Omit<Automation, 'id'>>;

      if (typeof items === 'object' && items !== null && !Array.isArray(items)) {
          for (const id of itemIdentifiers) {
              if (items[id]) {
                  liveItemsMap[id] = {
                      id: id,
                      ...(items[id] as Omit<Automation, 'id'>)
                  };
              }
          }
      } else {
          return NextResponse.json({ error: `${configFileName} is not in the expected format.` }, { status: 500 });
      }
    } else {
        return NextResponse.json({ error: `Unsupported mode: ${mode}` }, { status: 400 });
    }

    return NextResponse.json({ liveItems: liveItemsMap });

  } catch (error: unknown) {
    const err = error as Error & { code?: string; path?: string };
    if (err.code === 'ENOENT') {
        return NextResponse.json({ error: `${err.path} not found.` }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: `Failed to read or parse live ${mode} file.`, details: err.message }, { status: 500 });
  }
}
