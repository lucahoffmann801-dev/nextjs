"use client";

import { FormEvent, useMemo, useState } from "react";

type Payer = "Jan" | "Luca";

type Expense = {
  id: number;
  title: string;
  payer: Payer;
  amount: number;
  category: string;
};

const heroImage =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Aerial_view_of_Balos_Beach_and_Lagoon_on_Crete%2C_Greece.jpg/1280px-Aerial_view_of_Balos_Beach_and_Lagoon_on_Crete%2C_Greece.jpg";

const elafonisiImage =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Greece_Crete_Elafonisi_Beach_The_Sun_Holidays.jpg/1280px-Greece_Crete_Elafonisi_Beach_The_Sun_Holidays.jpg";

const itinerary = [
  {
    day: "Tag 1",
    title: "Ankommen in Chania",
    area: "Altstadt, Hafen, erste Gyros-Runde",
    pace: "leicht",
    drive: "Flughafen - Unterkunft - Hafen",
    budget: "40-70 EUR",
    notes: [
      "Mietwagen uebernehmen und Fotos vom Auto machen",
      "Abendrunde am Venezianischen Hafen",
      "Wasser, Snacks und Sonnencreme fuer den ersten Ausflug kaufen",
    ],
  },
  {
    day: "Tag 2",
    title: "Balos & Gramvousa",
    area: "Lagune, Boot oder frueher Roadtrip",
    pace: "hoch",
    drive: "Chania - Kissamos - Balos",
    budget: "55-95 EUR",
    notes: [
      "Wind und Bootslage morgens checken",
      "Badeschuhe und Extra-Wasser einpacken",
      "Rueckfahrt nicht zu spaet starten",
    ],
  },
  {
    day: "Tag 3",
    title: "Elafonisi Beach",
    area: "Lagune, Badepause, Sonnenuntergang",
    pace: "mittel",
    drive: "Chania - Topolia - Elafonisi",
    budget: "35-65 EUR",
    notes: [
      "Frueh los, damit Parken entspannt bleibt",
      "Topolia-Schlucht als Mini-Stopp mitnehmen",
      "Kuehlbox und Muellbeutel einpacken",
    ],
  },
  {
    day: "Tag 4",
    title: "Rethymno & Arkadi",
    area: "Altstadt, Kloster, ruhiger Abend",
    pace: "leicht",
    drive: "Chania - Arkadi - Rethymno",
    budget: "45-80 EUR",
    notes: [
      "Mittag in Rethymno statt am Hotspot-Strand",
      "Kurze Kulturpause im Kloster Arkadi",
      "Abends Budget kurz ausgleichen",
    ],
  },
  {
    day: "Tag 5",
    title: "Suedkueste: Matala",
    area: "Hoehlen, Strand, kleine Tavernen",
    pace: "mittel",
    drive: "Chania - Matala",
    budget: "60-100 EUR",
    notes: [
      "Lange Fahrt mit Kaffeestopp planen",
      "Bargeld fuer kleinere Tavernen mitnehmen",
      "Rueckweg nur fahren, wenn beide fit sind",
    ],
  },
  {
    day: "Tag 6",
    title: "Heraklion & Knossos",
    area: "Geschichte, Markt, Hafen",
    pace: "mittel",
    drive: "Unterkunft - Knossos - Heraklion",
    budget: "55-95 EUR",
    notes: [
      "Tickets und Oeffnungszeiten am Vortag checken",
      "Mittag nicht direkt am Eingang einplanen",
      "Abends leichter Strand- oder Poolslot",
    ],
  },
  {
    day: "Tag 7",
    title: "Freier Jan-Luca-Tag",
    area: "Reserve fuer Wetter, Schlaf oder Lieblingsort",
    pace: "frei",
    drive: "kurz halten",
    budget: "25-60 EUR",
    notes: [
      "Top 1 Wunsch von Jan und Top 1 Wunsch von Luca waehlen",
      "Keine harte Abfahrtszeit setzen",
      "Letzten Abend ohne Excel-Gefuehl geniessen",
    ],
  },
];

const initialExpenses: Expense[] = [
  { id: 1, title: "Mietwagen Anzahlung", payer: "Jan", amount: 180, category: "Mobilitaet" },
  { id: 2, title: "Erster Supermarkt", payer: "Luca", amount: 64.8, category: "Essen" },
  { id: 3, title: "Benzin Westkueste", payer: "Jan", amount: 52.4, category: "Mobilitaet" },
  { id: 4, title: "Balos Boot/Faehre", payer: "Luca", amount: 92, category: "Ausflug" },
];

const packItems = [
  "Ausweise und Fuehrerschein",
  "Reisekarte offline",
  "Sonnencreme SPF 50",
  "Badeschuhe",
  "Powerbank",
  "Kleine Reiseapotheke",
  "Bargeld fuer Tavernen",
  "Muellsack fuer Strandtage",
];

const spots = [
  {
    name: "Balos Lagune",
    detail: "Frueher Start, starkes Licht, Wasser einplanen.",
    href: "https://www.google.com/maps/search/?api=1&query=Balos+Beach+Crete",
  },
  {
    name: "Elafonisi",
    detail: "Bester Badetag, aber windabhaengig.",
    href: "https://www.google.com/maps/search/?api=1&query=Elafonisi+Beach+Crete",
  },
  {
    name: "Chania Hafen",
    detail: "Perfekt fuer den ersten und letzten Abend.",
    href: "https://www.google.com/maps/search/?api=1&query=Chania+Old+Venetian+Harbor",
  },
  {
    name: "Knossos",
    detail: "Kulturblock mit Heraklion kombinieren.",
    href: "https://www.google.com/maps/search/?api=1&query=Knossos+Crete",
  },
];

const formatEUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export default function Home() {
  const [activeDay, setActiveDay] = useState(1);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [checked, setChecked] = useState<Record<string, boolean>>({
    "Ausweise und Fuehrerschein": true,
    "Reisekarte offline": true,
  });
  const [title, setTitle] = useState("");
  const [payer, setPayer] = useState<Payer>("Jan");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Essen");

  const currentDay = itinerary[activeDay];

  const totals = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) => {
          sum.total += expense.amount;
          sum[expense.payer] += expense.amount;
          return sum;
        },
        { Jan: 0, Luca: 0, total: 0 } as Record<Payer | "total", number>,
      ),
    [expenses],
  );

  const doneCount = packItems.filter((item) => checked[item]).length;
  const difference = totals.Jan - totals.Luca;
  const settlement = Math.abs(difference) / 2;
  const payerName = difference > 0 ? "Luca" : "Jan";
  const receiverName = difference > 0 ? "Jan" : "Luca";

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount.replace(",", "."));

    if (!title.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    setExpenses((current) => [
      {
        id: Date.now(),
        title: title.trim(),
        payer,
        amount: parsedAmount,
        category,
      },
      ...current,
    ]);
    setTitle("");
    setAmount("");
  }

  return (
    <main className="min-h-screen overflow-hidden">
      <section className="relative min-h-[74svh] overflow-hidden bg-[#102f35] text-white">
        <img
          src={heroImage}
          alt="Balos Lagune auf Kreta von oben"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,34,39,0.88),rgba(9,34,39,0.5),rgba(9,34,39,0.12))]" />
        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="#plan" className="text-sm font-semibold uppercase tracking-[0.28em] text-white/85">
            Kreta
          </a>
          <div className="flex items-center gap-2 rounded-full bg-white/12 p-1 text-sm backdrop-blur">
            <a className="rounded-full px-3 py-2 text-white/85 transition hover:bg-white/15 hover:text-white" href="#plan">
              Plan
            </a>
            <a className="rounded-full px-3 py-2 text-white/85 transition hover:bg-white/15 hover:text-white" href="#budget">
              Kosten
            </a>
            <a className="rounded-full px-3 py-2 text-white/85 transition hover:bg-white/15 hover:text-white" href="#orte">
              Orte
            </a>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex min-h-[calc(74svh-88px)] w-full max-w-7xl items-center px-5 pb-10 pt-8 sm:px-8">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex rounded-full border border-white/25 bg-white/12 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
              Jan & Luca unterwegs
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-normal text-white sm:text-7xl lg:text-8xl">
              Kreta fuer Jan & Luca
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/88 sm:text-xl">
              Eine gemeinsame Reise-App fuer Strandtage, Roadtrips, Packliste und den fairen Kosten-Ausgleich.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#plan"
                className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#15373d] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#f0fbff]"
              >
                Tagesplan oeffnen
              </a>
              <a
                href="#budget"
                className="rounded-full border border-white/35 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/18"
              >
                Budget checken
              </a>
            </div>
          </div>
        </div>
        <p className="absolute bottom-3 right-5 z-10 text-xs text-white/75">
          Bild: Balos Lagoon, dronepicr / CC BY 2.0
        </p>
      </section>

      <section id="plan" className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[8px] border border-[#dbe7df] bg-white/92 p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d36b3d]">Route</p>
              <h2 className="text-3xl font-black text-[#17201c]">Tagesplan</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#5d6b62]">
              Flexibel gedacht: wenn Wind, Hitze oder Muede-Sein reingraetschen, wird Tag 7 zum Joker.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {itinerary.map((item, index) => (
              <button
                key={item.day}
                onClick={() => setActiveDay(index)}
                className={`min-h-16 rounded-[8px] border px-3 py-3 text-left transition ${
                  activeDay === index
                    ? "border-[#145f68] bg-[#145f68] text-white shadow-md"
                    : "border-[#dbe7df] bg-[#f7fbf8] text-[#24312a] hover:border-[#145f68]/55"
                }`}
              >
                <span className="block text-xs font-bold uppercase tracking-[0.14em] opacity-80">{item.day}</span>
                <span className="mt-1 block text-sm font-bold leading-5">{item.title}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="overflow-hidden rounded-[8px] border border-[#dbe7df] bg-[#102f35]">
              <img src={elafonisiImage} alt="Elafonisi Strand auf Kreta" className="h-64 w-full object-cover" />
              <div className="p-4 text-white">
                <p className="text-sm uppercase tracking-[0.16em] text-white/70">Bildanker</p>
                <h3 className="mt-1 text-2xl font-black">Meer, Route, Reserve</h3>
              </div>
            </div>
            <article className="rounded-[8px] border border-[#dbe7df] bg-[#f7fbf8] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#d36b3d]/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#9c4424]">
                  {currentDay.pace}
                </span>
                <span className="rounded-full bg-[#145f68]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#145f68]">
                  {currentDay.budget}
                </span>
              </div>
              <h3 className="mt-4 text-3xl font-black text-[#17201c]">{currentDay.title}</h3>
              <p className="mt-2 text-base font-semibold text-[#435046]">{currentDay.area}</p>
              <p className="mt-4 rounded-[8px] border border-[#dbe7df] bg-white px-4 py-3 text-sm font-bold text-[#24312a]">
                Strecke: {currentDay.drive}
              </p>
              <ul className="mt-5 space-y-3">
                {currentDay.notes.map((note) => (
                  <li key={note} className="flex gap-3 text-sm leading-6 text-[#435046]">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#d36b3d]" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-[8px] border border-[#dbe7df] bg-white/92 p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#145f68]">Packen</p>
                <h2 className="text-3xl font-black text-[#17201c]">{doneCount}/{packItems.length}</h2>
              </div>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#e5eee8]">
                <div
                  className="h-full rounded-full bg-[#145f68] transition-all"
                  style={{ width: `${(doneCount / packItems.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              {packItems.map((item) => {
                const isChecked = Boolean(checked[item]);

                return (
                  <label
                    key={item}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[8px] border px-3 py-2 text-sm font-semibold transition ${
                      isChecked
                        ? "border-[#145f68]/35 bg-[#145f68]/8 text-[#17201c]"
                        : "border-[#dbe7df] bg-[#f7fbf8] text-[#435046]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => setChecked((current) => ({ ...current, [item]: !current[item] }))}
                      className="h-5 w-5 accent-[#145f68]"
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-[8px] border border-[#dbe7df] bg-[#17201c] p-5 text-white shadow-sm sm:p-6">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9ed8df]">Morgencheck</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {["Wind", "Wasser", "Route"].map((item) => (
                <div key={item} className="rounded-[8px] border border-white/12 bg-white/8 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">{item}</p>
                  <p className="mt-2 text-lg font-black">OK?</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-white/72">
              Kurz vor langen Strand- und Bergtagen lokale Lage, Tankstand und Rueckweg checken.
            </p>
          </div>
        </div>
      </section>

      <section id="budget" className="border-y border-[#dbe7df] bg-[#eef4ef]">
        <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-8 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[8px] border border-[#dbe7df] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d36b3d]">Kosten</p>
            <h2 className="mt-1 text-3xl font-black text-[#17201c]">Fair teilen</h2>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-[8px] bg-[#f7fbf8] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5d6b62]">Gesamt</p>
                <p className="mt-2 text-2xl font-black text-[#17201c]">{formatEUR.format(totals.total)}</p>
              </div>
              <div className="rounded-[8px] bg-[#f7fbf8] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5d6b62]">Jan</p>
                <p className="mt-2 text-2xl font-black text-[#145f68]">{formatEUR.format(totals.Jan)}</p>
              </div>
              <div className="rounded-[8px] bg-[#f7fbf8] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5d6b62]">Luca</p>
                <p className="mt-2 text-2xl font-black text-[#d36b3d]">{formatEUR.format(totals.Luca)}</p>
              </div>
            </div>
            <div className="mt-5 rounded-[8px] border border-[#145f68]/20 bg-[#145f68]/8 p-5">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#145f68]">Ausgleich</p>
              <p className="mt-2 text-2xl font-black text-[#17201c]">
                {settlement < 0.01
                  ? "Alles gerade."
                  : `${payerName} zahlt ${formatEUR.format(settlement)} an ${receiverName}.`}
              </p>
            </div>

            <form onSubmit={addExpense} className="mt-5 grid gap-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ausgabe"
                className="min-h-12 rounded-[8px] border border-[#ccdacf] bg-white px-4 text-[#17201c] outline-none transition focus:border-[#145f68]"
              />
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
                <select
                  value={payer}
                  onChange={(event) => setPayer(event.target.value as Payer)}
                  className="min-h-12 rounded-[8px] border border-[#ccdacf] bg-white px-4 text-[#17201c] outline-none transition focus:border-[#145f68]"
                >
                  <option>Jan</option>
                  <option>Luca</option>
                </select>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="min-h-12 rounded-[8px] border border-[#ccdacf] bg-white px-4 text-[#17201c] outline-none transition focus:border-[#145f68]"
                >
                  <option>Essen</option>
                  <option>Mobilitaet</option>
                  <option>Ausflug</option>
                  <option>Unterkunft</option>
                  <option>Sonstiges</option>
                </select>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Betrag"
                  inputMode="decimal"
                  className="min-h-12 rounded-[8px] border border-[#ccdacf] bg-white px-4 text-[#17201c] outline-none transition focus:border-[#145f68]"
                />
              </div>
              <button className="min-h-12 rounded-[8px] bg-[#17201c] px-5 text-sm font-black text-white transition hover:bg-[#145f68]">
                Ausgabe eintragen
              </button>
            </form>
          </div>

          <div className="rounded-[8px] border border-[#dbe7df] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#145f68]">Logbuch</p>
                <h2 className="mt-1 text-3xl font-black text-[#17201c]">Ausgaben</h2>
              </div>
              <button
                onClick={() => setExpenses(initialExpenses)}
                className="rounded-[8px] border border-[#ccdacf] px-4 py-2 text-sm font-bold text-[#435046] transition hover:border-[#145f68] hover:text-[#145f68]"
              >
                Reset
              </button>
            </div>
            <div className="mt-5 divide-y divide-[#e2ebe5]">
              {expenses.map((expense) => (
                <div key={expense.id} className="grid grid-cols-[1fr_auto] gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-[#17201c]">{expense.title}</p>
                    <p className="mt-1 text-sm text-[#5d6b62]">
                      {expense.category} von {expense.payer}
                    </p>
                  </div>
                  <p className="font-mono text-lg font-black text-[#17201c]">{formatEUR.format(expense.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="orte" className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#d36b3d]">Orte</p>
            <h2 className="text-3xl font-black text-[#17201c]">Schnelllinks</h2>
          </div>
          <p className="max-w-lg text-sm leading-6 text-[#5d6b62]">
            Links oeffnen direkt die Suche in Google Maps und funktionieren gut als Startpunkt fuer Navigation.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {spots.map((spot) => (
            <a
              key={spot.name}
              href={spot.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-[8px] border border-[#dbe7df] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#145f68]/45"
            >
              <p className="text-xl font-black text-[#17201c]">{spot.name}</p>
              <p className="mt-3 text-sm leading-6 text-[#5d6b62]">{spot.detail}</p>
              <span className="mt-5 inline-flex rounded-full bg-[#145f68]/10 px-3 py-2 text-sm font-bold text-[#145f68] transition group-hover:bg-[#145f68] group-hover:text-white">
                Maps oeffnen
              </span>
            </a>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#dbe7df] bg-white/70 px-5 py-6 text-center text-xs leading-6 text-[#5d6b62] sm:px-8">
        Bildquellen: Balos Lagoon via Wikimedia Commons, dronepicr / CC BY 2.0. Elafonisi via Wikimedia Commons, jarekgrafik / CC0.
      </footer>
    </main>
  );
}
