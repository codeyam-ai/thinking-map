'use client';

// Everything about agent presence that is not the one-line answer.
//
// Split from `AgentStatus` because the two answer different questions: the
// header says WHETHER an agent is here, this says what that means and what the
// page can prove about it. And split again into three, because that is three
// answers, not one — what presence means in prose, which tools the browser
// actually took, and the build-time detail behind both. This file is the frame
// they sit in and the order they sit in, and nothing else.

import AgentBindDiagnostics from './AgentBindDiagnostics';
import AgentStatusNarrative from './AgentStatusNarrative';
import AgentToolChips from './AgentToolChips';
import type { AgentChannel } from '@/app/lib/agentPresence';
import type { BridgeStatus } from './WebMcpBridge';

export default function AgentStatusPanel({
  status,
  channel,
  reason,
  registered,
  bindFailures,
  convention,
  mapMissing,
}: {
  status: BridgeStatus;
  channel: AgentChannel | null;
  reason: string | null;
  registered: string[];
  bindFailures: { name: string; reason: string }[];
  convention: 'registerTool' | 'provideContext' | null;
  mapMissing: boolean;
}) {
  return (
    <div className="w-[300px] rounded-[14px] border border-line bg-surface p-4 text-left shadow-lg">
      <AgentStatusNarrative
        status={status}
        channel={channel}
        reason={reason}
        mapMissing={mapMissing}
      />
      <AgentToolChips names={registered} />
      <AgentBindDiagnostics
        status={status}
        channel={channel}
        convention={convention}
        bindFailures={bindFailures}
      />
    </div>
  );
}
