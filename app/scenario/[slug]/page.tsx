import { notFound, redirect } from 'next/navigation';
import { promises as fs } from 'fs';
import path from 'path';

export default async function ScenarioRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const { slug } = await params;

  // Note: Next.js implements redirect() by throwing a special error that
  // unwinds the render. Catching it here would swallow the redirect, so we
  // only use try/catch for the filesystem read and call redirect() after.
  let targetUrl: string | undefined;
  try {
    const file = await fs.readFile(
      path.join(process.cwd(), '.codeyam', 'scenarios', `${slug}.json`),
      'utf-8',
    );
    const scenario = JSON.parse(file) as { url?: string };
    targetUrl = scenario.url;
  } catch {
    // Missing file or malformed JSON — fall through to notFound().
  }

  if (targetUrl) {
    redirect(targetUrl);
  }
  notFound();
}
