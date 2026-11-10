import { Link } from 'react-router';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common';
import { QuestionBrowser } from '@/components/questions/question-browser';
import { useAuth } from '@/features/auth/context';

export function BrowseQuestionsPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader
        title="Browse questions"
        description="Explore doubts from students across every subject. Every question is anonymous."
        actions={
          user?.role === 'STUDENT' && (
            <Button asChild>
              <Link to="/questions/ask">
                <MessageSquarePlus className="size-4" /> Ask a question
              </Link>
            </Button>
          )
        }
      />
      <QuestionBrowser showAskCta={user?.role === 'STUDENT'} />
    </>
  );
}

export function MyQuestionsPage() {
  return (
    <>
      <PageHeader
        title="My questions"
        description="Only you can see which questions are yours. To everyone else they are posted by an anonymous student."
      />
      <QuestionBrowser mine showAskCta />
    </>
  );
}
