
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { haUrl, haToken, service } = body;

    if (!haUrl || !haToken || !service) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log('Service received:', service);

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${haToken}`,
      },
    };

    if (service !== 'homeassistant.restart') {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Content-Type': 'application/json',
      };
      fetchOptions.body = JSON.stringify({});
    }

    console.log('Fetch options for Home Assistant API:', fetchOptions);

    // Do not await the fetch call to make it non-blocking
    fetch(`${haUrl}/api/services/${service.replace('.', '/')}`, fetchOptions)
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to reload Home Assistant in background: ${errorText}`);
        } else {
          console.log('Home Assistant reload initiated successfully in background.');
        }
      })
      .catch((error) => {
        console.error('Error initiating Home Assistant reload in background:', error);
      });

    return NextResponse.json({ message: 'Home Assistant reload initiated successfully' });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
