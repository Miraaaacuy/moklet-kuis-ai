import { PlayClient } from "./play-client";

export default async function PlayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <PlayClient sessionId={sessionId} />;
}
