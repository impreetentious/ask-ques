import { ask } from '@/ask/config';
import { AskMachine } from '@/ui/ask-machine';

export default function HomePage() {
  return <AskMachine initialConfig={ask} />;
}
