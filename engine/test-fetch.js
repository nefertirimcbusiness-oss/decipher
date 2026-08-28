import 'dotenv/config';

async function test() {
  const key = process.env.OPENAI_API_KEY;
  const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

  console.log('Sending request to Gemini via fetch...');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gemini-3.6-flash',
        messages: [{ role: 'user', content: 'Say hello' }]
      })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
