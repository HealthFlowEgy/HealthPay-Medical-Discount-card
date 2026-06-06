import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <span className="inline-block rounded bg-teal-500 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
        HealthPay
      </span>
      <h1 className="mt-4 text-4xl font-bold text-navy-900">Quote Engine</h1>
      <p className="mt-4 text-lg text-navy-800">
        Medical-discount pricing quotes for partner platforms. Partners request
        pricing via the API/SDK, HealthPay operations attach discount options, and
        end users confirm their choice on a hosted quote page.
      </p>
      <p className="mt-4 rounded-lg border border-gold-500/40 bg-gold-400/10 p-4 text-sm text-navy-800">
        HealthPay is a medical discount card (15%–70% off services). It is{" "}
        <strong>not insurance</strong> — every request is a quote-for-discount-pricing
        flow, and no clinical or diagnosis data is collected.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/ops"
          className="rounded-lg bg-navy-900 px-5 py-2.5 font-medium text-white hover:bg-navy-800"
        >
          Operations dashboard
        </Link>
        <a
          href="https://github.com/HealthFlowEgy/HealthPay-Medical-Discount-card"
          className="rounded-lg border border-navy-900/20 px-5 py-2.5 font-medium text-navy-900 hover:bg-white"
        >
          Documentation
        </a>
      </div>
    </main>
  );
}
