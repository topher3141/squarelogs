"use client";

import { useEffect, useMemo, useState } from "react";

type ReceiptItem = {
  title: string;
  quantity: number;
  amount?: number;
};

type ReceiptRecord = {
  paymentId: string;
  orderId: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  timestamp: number;
  deviceName?: string;
  paymentType?: string;
  receiptUrl?: string;
  items: ReceiptItem[];
};

const UNIFI_CONSOLE_ID =
  "58D61F643B0E0000000009A9F63E000000000A325D6600000000692AA50E:1493167662";

const UNIFI_CAMERA_ID =
  "69c41ae4010ec003e400040c";

function footageUrl(timestamp: number) {
  const start = Math.max(0, timestamp - 20_000);

  return (
    `https://unifi.ui.com/consoles/${UNIFI_CONSOLE_ID}` +
    `/protect/timelapse/${UNIFI_CAMERA_ID}` +
    `?start=${start}`
  );
}

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const dateTime = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));

export default function Home() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [register, setRegister] = useState("");
  const [payment, setPayment] = useState("");
  const [selected, setSelected] =
    useState<ReceiptRecord | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          limit: "750",
        });

        if (q) params.set("q", q);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (register) params.set("register", register);
        if (payment) params.set("payment", payment);

        const res = await fetch(
          `/api/receipts?${params}`,
          {
            cache: "no-store",
          }
        );

        const data = await res.json();

        setReceipts(data.receipts || []);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [q, from, to, register, payment]);

  const registers = useMemo(
    () =>
      Array.from(
        new Set(
          receipts
            .map((r) => r.deviceName)
            .filter(Boolean)
        )
      ) as string[],
    [receipts]
  );

  const paymentTypes = useMemo(
    () =>
      Array.from(
        new Set(
          receipts
            .map((r) => r.paymentType)
            .filter(Boolean)
        )
      ) as string[],
    [receipts]
  );

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <div className="eyebrow">
            DEALS &amp; STEALS
          </div>

          <h1>Receipt &amp; Video Search</h1>

          <p>
            Find a store transaction and jump directly
            to the matching Checkout footage.
          </p>
        </div>

        <div className="status">
          <span />
          Square + Protect
        </div>
      </header>

      <section className="filters">
        <div className="searchWrap">
          <span className="searchIcon">
            ⌕
          </span>

          <input
            value={q}
            onChange={(e) =>
              setQ(e.target.value)
            }
            placeholder="Search receipt #, item, amount, payment ID..."
          />
        </div>

        <div className="filterGrid">
          <label>
            <span>From</span>

            <input
              type="date"
              value={from}
              onChange={(e) =>
                setFrom(e.target.value)
              }
            />
          </label>

          <label>
            <span>To</span>

            <input
              type="date"
              value={to}
              onChange={(e) =>
                setTo(e.target.value)
              }
            />
          </label>

          <label>
            <span>Register</span>

            <select
              value={register}
              onChange={(e) =>
                setRegister(e.target.value)
              }
            >
              <option value="">
                All registers
              </option>

              {registers.map((r) => (
                <option
                  key={r}
                  value={r}
                >
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Payment</span>

            <select
              value={payment}
              onChange={(e) =>
                setPayment(e.target.value)
              }
            >
              <option value="">
                All payment types
              </option>

              {paymentTypes.map((p) => (
                <option
                  key={p}
                  value={p}
                >
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="resultsHeader">
        <div>
          <strong>
            {loading
              ? "Searching…"
              : `${receipts.length} receipts`}
          </strong>

          <span>
            Only physical Square POS transactions are stored.
          </span>
        </div>

        {(q ||
          from ||
          to ||
          register ||
          payment) && (
          <button
            className="clear"
            onClick={() => {
              setQ("");
              setFrom("");
              setTo("");
              setRegister("");
              setPayment("");
            }}
          >
            Clear filters
          </button>
        )}
      </section>

      <section className="receiptList">
        {!loading &&
          receipts.length === 0 && (
            <div className="empty">
              <div className="emptyIcon">
                ⌕
              </div>

              <h2>
                No receipts found
              </h2>

              <p>
                Try a different receipt number,
                item, amount, or date range.
              </p>
            </div>
          )}

        {receipts.map((receipt) => (
          <article
            className="receiptCard"
            key={receipt.paymentId}
            onClick={() =>
              setSelected(receipt)
            }
          >
            <div className="receiptMain">
              <div className="receiptNumber">
                #{receipt.receiptNumber}
              </div>

              <div className="meta">
                {dateTime(
                  receipt.timestamp
                )}

                <span>•</span>

                {receipt.deviceName ||
                  "Square Register"}
              </div>

              <div className="itemPreview">
                {receipt.items.length
                  ? receipt.items
                      .slice(0, 3)
                      .map(
                        (i) =>
                          `${i.quantity}× ${i.title}`
                      )
                      .join(" · ")
                  : "No item details"}

                {receipt.items.length > 3
                  ? ` · +${
                      receipt.items
                        .length - 3
                    } more`
                  : ""}
              </div>
            </div>

            <div className="receiptSide">
              <div className="amount">
                {money(
                  receipt.amount
                )}
              </div>

              <div className="paymentType">
                {receipt.paymentType ||
                  "Payment"}
              </div>

              <div className="cardActions">
                {receipt.receiptUrl && (
                  <a
                    href={
                      receipt.receiptUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) =>
                      e.stopPropagation()
                    }
                  >
                    Receipt
                  </a>
                )}

                <a
                  className="video"
                  href={footageUrl(
                    receipt.timestamp
                  )}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) =>
                    e.stopPropagation()
                  }
                >
                  ▶ Footage
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>

      {selected && (
        <div
          className="modalBackdrop"
          onClick={() =>
            setSelected(null)
          }
        >
          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <button
              className="close"
              onClick={() =>
                setSelected(null)
              }
            >
              ×
            </button>

            <div className="modalTop">
              <div>
                <div className="eyebrow">
                  RECEIPT
                </div>

                <h2>
                  #{selected.receiptNumber}
                </h2>

                <p>
                  {dateTime(
                    selected.timestamp
                  )}{" "}
                  ·{" "}
                  {selected.deviceName ||
                    "Square Register"}
                </p>
              </div>

              <div className="modalAmount">
                {money(
                  selected.amount
                )}
              </div>
            </div>

            <div className="detailPills">
              <span>
                {selected.paymentType ||
                  "Payment"}
              </span>

              <span>
                {selected.items.length} line item
                {selected.items.length === 1
                  ? ""
                  : "s"}
              </span>
            </div>

            <div className="items">
              {selected.items.map(
                (item, index) => (
                  <div
                    className="itemRow"
                    key={`${item.title}-${index}`}
                  >
                    <div>
                      <strong>
                        {item.title}
                      </strong>

                      <span>
                        Qty{" "}
                        {item.quantity}
                      </span>
                    </div>

                    {typeof item.amount ===
                      "number" && (
                      <b>
                        {money(
                          item.amount
                        )}
                      </b>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="modalActions">
              {selected.receiptUrl && (
                <a
                  href={
                    selected.receiptUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  View Square Receipt
                </a>
              )}

              <a
                className="primary"
                href={footageUrl(
                  selected.timestamp
                )}
                target="_blank"
                rel="noreferrer"
              >
                ▶ View Checkout Footage
              </a>
            </div>

            <div className="footnote">
              Footage opens approximately
              20 seconds before the Square
              transaction timestamp.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
