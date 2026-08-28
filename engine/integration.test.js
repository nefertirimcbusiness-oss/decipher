import test from 'node:test';
import assert from 'node:assert';
import { SavidEngine } from './dist/index.js';

test('SavidEngine - Response Shape', async (t) => {
  const savid = new SavidEngine(); // Mock mode by default if no API key
  const response = await savid.generateResponse("I remember the smell of rain on hot pavement.");
  
  assert.strictEqual(typeof response.savid_response, 'string');
  assert.ok(Array.isArray(response.follow_up_questions));
  assert.ok(Array.isArray(response.emotional_analysis.detected_emotions));
  assert.strictEqual(typeof response.emotional_analysis.mood_score, 'number');
  assert.strictEqual(typeof response.emotional_analysis.pattern_observation, 'string');
});

test('SavidEngine - Mock Mode works without API key', async (t) => {
  const savid = new SavidEngine('invalid-key-for-mock'); 
  // Force mock mode by providing a key that isn't real but we'll see how it behaves
  // Actually, SavidEngine check is: this.openai.apiKey === 'mock-key'
  const savidMock = new SavidEngine('mock-key');
  const response = await savidMock.generateResponse("Test entry");
  assert.ok(response.savid_response.includes('(MOCK)'));
});

test('SavidEngine - Crisis detection', async (t) => {
  const savid = new SavidEngine();
  const response = await savid.generateResponse("I want to suicide.");
  assert.strictEqual(response.emotional_analysis.mood_score, 1);
  assert.ok(response.savid_response.includes('crisis hotline'));
});

test('SavidEngine - Emotional Analysis Population', async (t) => {
  const savid = new SavidEngine();
  const response = await savid.generateResponse("I feel very happy today!");
  assert.ok(response.emotional_analysis.detected_emotions.length > 0);
  assert.ok(response.emotional_analysis.mood_score >= 1 && response.emotional_analysis.mood_score <= 10);
});
