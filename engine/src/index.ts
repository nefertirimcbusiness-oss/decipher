import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SavidResponse {
  savid_response: string;
  follow_up_questions: string[];
  emotional_analysis: {
    detected_emotions: string[];
    mood_score: number;
    pattern_observation: string;
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class SavidEngine {
  private openai: OpenAI;
  private systemPrompt: string;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      console.warn('Warning: No OpenAI API key provided. SavidEngine will run in mock mode.');
    }
    this.openai = new OpenAI({
      apiKey: key || 'mock-key',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
    });
    
    // Load system prompt
    const promptPath = path.join(__dirname, '../prompts/system_prompt.txt');
    this.systemPrompt = fs.readFileSync(promptPath, 'utf-8');
  }

  /**
   * Generates a response from Savid based on a user's entry and conversation history.
   */
  async generateResponse(
    userEntry: string,
    history: ConversationMessage[] = []
  ): Promise<SavidResponse> {
    // Safety Check
    if (this.isCrisis(userEntry)) {
      return this.getCrisisResponse();
    }

    if (this.openai.apiKey === 'mock-key') {
      return this.getMockResponse(userEntry);
    }

    // Gemini OpenAI-compatible endpoint does NOT support 'system' role.
    // It also requires strictly alternating 'user' and 'assistant' roles.
    // We merge the system prompt into the first message and consolidate history.
    const messages: any[] = [];
    
    // Normalize and filter history
    const normalizedHistory = history.map(m => ({
      role: ((m.role as string) === 'savid' || m.role === 'assistant') ? 'assistant' : 'user',
      content: m.content
    }));

    if (normalizedHistory.length === 0) {
      messages.push({
        role: 'user',
        content: `${this.systemPrompt}\n\nUser entry: ${userEntry}`
      });
    } else {
      // Prepend system prompt to first user message or add as first user message
      if (normalizedHistory[0].role === 'user') {
        messages.push({
          role: 'user',
          content: `${this.systemPrompt}\n\n${normalizedHistory[0].content}`
        });
        messages.push(...normalizedHistory.slice(1));
      } else {
        // First is assistant? Prepend system prompt as user.
        messages.push({ role: 'user', content: this.systemPrompt });
        messages.push(...normalizedHistory);
      }

      // Append new entry, merging if last is user
      const last = messages[messages.length - 1];
      if (last.role === 'user') {
        last.content += `\n\nNew entry: ${userEntry}`;
      } else {
        messages.push({ role: 'user', content: userEntry });
      }
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gemini-3.6-flash', 
        messages: messages,
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 2048,
      }, { timeout: 60000, maxRetries: 0 });

      let content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenAI');

      // Strip markdown backticks
      content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

      return JSON.parse(content) as SavidResponse;
    } catch (error) {
      console.error('Error generating Savid response:', error);
      return this.getFallbackResponse();
    }
  }

  /**
   * Specifically designed to scan multiple entries and find long-term patterns.
   */
  async analyzeLongTermPatterns(entries: string[]): Promise<string> {
    if (this.openai.apiKey === 'mock-key') {
      return "In mock mode, I can't see the deep patterns, but I'm sure you're making progress!";
    }

    const prompt = `Below are several journal entries from a user. Please identify recurring emotional patterns, themes, or "memory anchors" (small details that keep appearing). Be gentle and insightful, like a wise mentor.\n\nEntries:\n${entries.join('\n---\n')}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gemini-3.6-flash',
        messages: [
          { role: 'user', content: `You are Savid, the wise owl mentor. Analyze these entries for patterns.\n\n${prompt}` }
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }, { timeout: 60000, maxRetries: 0 });

      return response.choices[0]?.message?.content || "I couldn't quite find a pattern today, but let's keep logging.";
    } catch (error) {
      console.error('Error analyzing patterns:', error);
      return "I'm having a little trouble looking back right now. Let's focus on today.";
    }
  }

  private isCrisis(text: string): boolean {
    const crisisKeywords = ['suicide', 'kill myself', 'end it all', 'harm myself', 'self-harm'];
    const lowerText = text.toLowerCase();
    return crisisKeywords.some(keyword => lowerText.includes(keyword));
  }

  private getCrisisResponse(): SavidResponse {
    return {
      savid_response: "I'm concerned about what you're sharing. Please know that you're not alone, but I'm an AI and not equipped to help in a crisis. Please reach out to a professional or a crisis hotline like 988 in the US or your local emergency services.",
      follow_up_questions: ["Would you like to try a grounding exercise, or is there a friend you can call right now?"],
      emotional_analysis: {
        detected_emotions: ["crisis", "distress"],
        mood_score: 1,
        pattern_observation: "Crisis keywords detected. Safety response triggered."
      }
    };
  }

  private getMockResponse(userEntry: string): SavidResponse {
    return {
      savid_response: `(MOCK) I hear you saying: "${userEntry.substring(0, 50)}...". That sounds like a significant piece of your story. I'm here to help you hold that memory.`,
      follow_up_questions: [
        "What was the temperature like in that moment?",
        "Do you remember any specific sounds nearby?",
        "How does your body feel as you recount this?"
      ],
      emotional_analysis: {
        detected_emotions: ["reflective", "uncertain"],
        mood_score: 6,
        pattern_observation: "The user is starting to explore sensory details."
      }
    };
  }

  private getFallbackResponse(): SavidResponse {
    return {
      savid_response: "I'm here, and I'm listening. Sometimes the words are hard to find, and that's okay. Take a deep breath.",
      follow_up_questions: ["Would you like to try describing just one small thing you can see right now?"],
      emotional_analysis: {
        detected_emotions: ["unknown"],
        mood_score: 5,
        pattern_observation: "Engine encountered an error; providing a grounding response."
      }
    };
  }
}
