import { Link } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { ROUTES } from '@/constants/routes.js';

/**
 * Public entry point. Kept deliberately spare: the shell's job is to get
 * people to sign in, and a marketing site isn't in scope. The hero
 * states what the product is in one sentence and gets out of the way.
 */
export function LandingPage() {
  useDocumentTitle('Competitive programming, head to head');
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      <div className="grid-hairline absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center sm:py-32">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Badge variant="accent">ranked 1v1 · live judge</Badge>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Competitive programming, head to head.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-fg-muted)]">
            Match against someone at your rating, solve the same problem on the same clock, and
            watch the verdicts land in real time.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to={ROUTES.SIGNUP}>
                Create an account
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link to={ROUTES.LOGIN}>Sign in</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
