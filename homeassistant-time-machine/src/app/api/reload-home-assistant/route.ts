
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { haUrl, haToken, service } = body;

    if (!haUrl || !haToken || !service) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${haToken}`,
      },
    };

    if (service !== 'home_assistant.restart') {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Content-Type': 'application/json',
      };
      fetchOptions.body = JSON.stringify({});
    }

    const response = await fetch(`${haUrl}/api/services/${service.replace('.', '/')}`, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Failed to reload Home Assistant: ${errorText}` }, { status: response.status });
    }

    return NextResponse.json({ message: 'Home Assistant reloaded successfully' });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
