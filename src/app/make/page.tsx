import type { Metadata } from 'next';
import { MakeForm } from '@/ui/make-form';

export const metadata: Metadata = {
  title: 'Make a question — Ask Ques',
  description: 'Make a shareable Ask Ques link without sending any words to a server.',
};

export default function MakePage() {
  return <MakeForm />;
}
