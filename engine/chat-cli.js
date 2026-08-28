import { SavidEngine } from './dist/index.js';
import readline from 'readline';
import 'dotenv/config';

const savid = new SavidEngine();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("--- Savid Chat CLI ---");
console.log("Type your entry below (or type 'exit' to quit).");

const history = [];

function ask() {
  rl.question('\nYou: ', async (answer) => {
    if (answer.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    console.log('\nSavid is thinking...');
    try {
      const response = await savid.generateResponse(answer, history);
      
      console.log('\nSavid:', response.savid_response);
      console.log('\nFollow-up Questions:');
      response.follow_up_questions.forEach(q => console.log(`- ${q}`));
      
      console.log('\n[Emotional Analysis]');
      console.log(`Detected Emotions: ${response.emotional_analysis.detected_emotions.join(', ')}`);
      console.log(`Mood Score: ${response.emotional_analysis.mood_score}/10`);
      console.log(`Observation: ${response.emotional_analysis.pattern_observation}`);

      // Add to history
      history.push({ role: 'user', content: answer });
      history.push({ role: 'assistant', content: response.savid_response });
      
      ask();
    } catch (error) {
      console.error('Error:', error.message);
      ask();
    }
  });
}

ask();
