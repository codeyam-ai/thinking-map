import Component from "../../components/EmptyHint";

const scenarios: Record<string, true> = { Default: true };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  if (!scenarios[s]) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <ul style={{ width: "100%", maxWidth: 360 }}>
        <Component />
      </ul>
    </div>
  );
}
