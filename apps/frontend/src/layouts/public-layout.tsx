import { Outlet } from 'react-router';
import { Navbar } from '@/components/organisms/navbar.js';
import { Footer } from '@/components/organisms/footer.js';
import { PageTransition } from '@/components/organisms/page-transition.js';

/** Marketing / signed-out chrome: public navbar, content, footer. */
export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      <Navbar />
      <main id="main" className="flex-1">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <Footer />
    </div>
  );
}
