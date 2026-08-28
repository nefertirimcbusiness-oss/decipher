# Savid Engine Integration Guide

This document explains how to integrate the `SavidEngine` into the Decipher backend.

## 1. Installation

The `savid-engine` is a local package located at `/home/team/shared/savid-engine`.
It should be added to your `package.json` as a file dependency:

```json
"dependencies": {
  "savid-engine": "file:../savid-engine"
}
```

## 2. Basic Usage

Import the engine and initialize it. If no API key is provided, it will run in **Mock Mode**, which is useful for local development and testing.

```javascript
import { SavidEngine } from 'savid-engine';

// Uses process.env.OPENAI_API_KEY if available, else Mock Mode
const savid = new SavidEngine(); 

// To force a specific key:
// const savid = new SavidEngine('your-api-key');
```

## 3. Generating a Response

The `generateResponse` method is asynchronous and takes the current user message and an optional conversation history.

```javascript
const userEntry = "I remember the smell of fresh bread at my grandma's house.";
const history = [
  { role: 'user', content: 'Tell me about your grandma.' },
  { role: 'assistant', content: 'I remember she had a big garden.' }
];

const response = await savid.generateResponse(userEntry, history);

/* 
response shape:
{
  savid_response: string,
  follow_up_questions: string[],
  emotional_analysis: {
    detected_emotions: string[],
    mood_score: number,
    pattern_observation: string
  }
}
*/
```

## 4. Safety & Crisis Detection

The engine has built-in crisis detection for specific keywords (e.g., "suicide", "harm myself"). When detected, it returns a hardcoded safety response and a mood score of 1.

## 5. Testing & Debugging

- **CLI Tool**: Use `node chat-cli.js` in the `savid-engine` folder to test the personality and responses manually.
- **Integration Tests**: Run `node integration.test.js` to verify the engine's behavior and output shape.

## 6. API Reference

### `generateResponse(userEntry, history)`
- `userEntry`: (String) The latest text from the user.
- `history`: (Array of objects) Optional. Array of `{ role, content }` objects where role is 'user' or 'assistant'.

### `analyzeLongTermPatterns(entries)`
- `entries`: (Array of strings) A list of historical entries to analyze for patterns.
