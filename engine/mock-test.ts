import { SavidEngine } from './dist/index.js';

async function test() {
  const savid = new SavidEngine(); // No key, will run in mock mode
  console.log('Testing SavidEngine in Mock Mode...');
  
  const response = await savid.generateResponse("I found an old photograph of a house I don't recognize.");
  
  console.log('Savid Response:', response.savid_response);
  console.log('Follow-up Questions:', response.follow_up_questions);
  console.log('Emotional Analysis:', response.emotional_analysis);
  
  const patterns = await savid.analyzeLongTermPatterns([
    "I'm feeling lost today.",
    "The sun was bright and it made me feel better."
  ]);
  console.log('Long-term Patterns:', patterns);
}

test().catch(console.error);
