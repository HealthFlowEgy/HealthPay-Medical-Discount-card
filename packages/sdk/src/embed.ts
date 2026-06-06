/**
 * Optional headless browser helper for partners who want to embed the pricing
 * cards directly instead of redirecting users to the hosted quote page.
 *
 * It consumes the PUBLIC token-authenticated quote endpoints — so no API secret
 * is ever exposed in the browser. Pass the quote token (the same one in the SMS
 * link / `quoteUrl`), not the request id, for that reason.
 *
 *   import { renderQuoteCards } from "@healthpay/quote-sdk/embed";
 *   renderQuoteCards(document.getElementById("cards")!, {
 *     baseUrl: "https://quotes.healthpay.example",
 *     token,
 *     onConfirmed: (req) => console.log("confirmed", req.selectedOptionId),
 *   });
 */

export interface EmbedOptions {
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
  onConfirmed?: (data: unknown) => void;
  onError?: (err: Error) => void;
}

interface EmbedOption {
  id: string;
  providerName: string;
  serviceDescription: string;
  listPrice: number;
  discountedPrice: number;
  discountPct: number;
  currency: string;
  validityNote: string | null;
}

interface EmbedQuote {
  status: string;
  options: EmbedOption[];
  selectedOptionId: string | null;
}

export async function renderQuoteCards(
  container: HTMLElement,
  opts: EmbedOptions,
): Promise<void> {
  const f = opts.fetch ?? globalThis.fetch;
  const base = opts.baseUrl.replace(/\/$/, "");
  let selected: string | null = null;

  function setText(msg: string) {
    container.textContent = msg;
  }

  async function load(): Promise<void> {
    try {
      const res = await f(`${base}/api/v1/quote/${opts.token}`);
      if (!res.ok) throw new Error(`Failed to load quote (${res.status}).`);
      const quote = (await res.json()) as EmbedQuote;
      selected = quote.selectedOptionId;
      paint(quote);
    } catch (err) {
      opts.onError?.(err instanceof Error ? err : new Error(String(err)));
      setText("Unable to load pricing.");
    }
  }

  async function confirm(): Promise<void> {
    if (!selected) return;
    try {
      const res = await f(`${base}/api/v1/quote/${opts.token}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionId: selected }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Confirmation failed.");
      opts.onConfirmed?.(body);
      paint(body as EmbedQuote);
    } catch (err) {
      opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  function paint(quote: EmbedQuote): void {
    container.innerHTML = "";
    if (quote.status === "pending_quote") {
      setText("Your pricing is being prepared.");
      return;
    }
    const confirmed = quote.status === "confirmed";

    for (const o of quote.options) {
      const card = document.createElement("button");
      card.type = "button";
      card.dataset.optionId = o.id;
      card.setAttribute(
        "style",
        [
          "display:block;width:100%;text-align:left;margin:8px 0;padding:14px",
          "border-radius:12px;cursor:pointer;background:#fff",
          `border:2px solid ${o.id === (quote.selectedOptionId ?? selected) ? "#14B8A6" : "#d4def0"}`,
        ].join(";"),
      );
      card.innerHTML =
        `<strong style="color:#0B1F3F">${escapeHtml(o.providerName)}</strong>` +
        `<div style="color:#475569;font-size:14px">${escapeHtml(o.serviceDescription)}</div>` +
        `<div style="margin-top:6px"><span style="text-decoration:line-through;color:#94a3b8">${o.listPrice} ${o.currency}</span> ` +
        `<span style="color:#0f9488;font-weight:700">${o.discountedPrice} ${o.currency}</span> ` +
        `<span style="color:#D4A24E">(-${o.discountPct}%)</span></div>`;
      if (!confirmed) {
        card.addEventListener("click", () => {
          selected = o.id;
          paint(quote);
        });
      }
      container.appendChild(card);
    }

    if (confirmed) {
      const done = document.createElement("div");
      done.setAttribute("style", "color:#047857;font-weight:600;margin-top:8px");
      done.textContent = "✓ Your selection is confirmed.";
      container.appendChild(done);
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Confirm my selection";
    btn.setAttribute(
      "style",
      "width:100%;margin-top:12px;padding:12px;border:0;border-radius:12px;background:#0B1F3F;color:#fff;font-weight:600;cursor:pointer",
    );
    btn.addEventListener("click", () => void confirm());
    container.appendChild(btn);
  }

  await load();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
