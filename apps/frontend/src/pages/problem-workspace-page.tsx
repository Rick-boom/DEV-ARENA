import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Alert } from '@/components/ui/alert.js';
import { Spinner } from '@/components/ui/spinner.js';
import { WorkspaceShell } from '@/features/workspace/components/workspace-shell.js';
import { useGetProblemQuery } from '@/store/api/problem-api.js';
import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { ROUTES } from '@/constants/routes.js';
import { NotificationVariant } from '@/types/ui.types.js';

/**
 * Workspace route. Resolves the problem, then hands off to the shell.
 *
 * The loading state is a full-height splash rather than a skeleton of
 * the panels: a half-drawn IDE reads as broken, whereas an honest
 * "loading" reads as fast.
 */
export function ProblemWorkspacePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: problem, isLoading, isError } = useGetProblemQuery(slug ?? '', { skip: !slug });
  useDocumentTitle(problem?.title ?? 'Workspace');

  if (isLoading) {
    return (
      <div className="grid h-[calc(100vh-3.5rem)] place-items-center">
        <Spinner size="lg" label="Loading problem" />
      </div>
    );
  }

  if (isError || !problem) {
    return (
      <div className="grid h-[calc(100vh-3.5rem)] place-items-center px-6">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <Alert variant={NotificationVariant.ERROR} title="Couldn't open this problem">
            It may have been removed, or the link is wrong.
          </Alert>
          <Button variant="secondary" asChild full>
            <Link to={ROUTES.PROBLEMS}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to problems
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <WorkspaceShell problem={problem} />;
}
