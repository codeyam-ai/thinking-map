import Component from '../../components/BoardWhereNextEmpty';

// A region of the far-end column with nothing in it yet.
//
// One scenario, because the component has one state and no props — but it is
// worth a scenario rather than a `trivial-wrapper` classification, because
// what it says is a product decision rather than a layout: an empty region
// describes the NEXT ACTION rather than the absence of data, and on this
// column that carries the whole argument. A thin region is a fact about how
// much thinking has happened, and the honest response to it is to keep going.

const scenarios: Record<string, Record<string, never>> = {
  Default: {},
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = 'Default' } = await searchParams;
  if (!scenarios[s]) return <div>Unknown scenario: {s}</div>;

  // It renders an <li>, so it needs the list it belongs to — and the panel
  // ground it is read against, since white/40 on white says nothing.
  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <div style={{ width: 420 }}>
        <section className="rounded-[20px] border border-white/10 bg-black/60 p-5">
          <span className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Still open
          </span>
          <ul className="flex flex-col gap-2.5">
            <Component />
          </ul>
        </section>
      </div>
    </div>
  );
}
