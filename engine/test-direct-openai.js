import OpenAI from 'openai';
import 'dotenv/config';

async function test() {
  const key = process.env.OPENAI_API_KEY;
  const client = new OpenAI({
    apiKey: key,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai'
  });

  console.log('Sending request to Gemini...');
  try {
    const response = await client.chat.completions.create({
      model: 'gemini-3.6-flash',
      messages: [{ role: 'user', content: 'Say hello' }],
    });
    console.log('Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
