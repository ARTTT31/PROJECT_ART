import ShareTargetClient from './ShareTargetClient';

interface ShareTargetPageProps {
  searchParams: Promise<{
    title?: string;
    text?: string;
    url?: string;
  }>;
}

export default async function ShareTargetPage({ searchParams }: ShareTargetPageProps) {
  const params = await searchParams;

  return (
    <ShareTargetClient
      initialTitle={params?.title || ''}
      initialText={params?.text || ''}
      initialUrl={params?.url || ''}
    />
  );
}
