// Interactive tripwire: deploy:prod refuses to run unless the operator types the project id.
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question('Deploying to PRODUCTION (ubayy-prod). Type "ubayy-prod" to continue: ');
rl.close();
if (answer.trim() !== 'ubayy-prod') {
  console.error('Aborted — production deploy not confirmed.');
  process.exit(1);
}
