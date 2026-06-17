export type Person = "Luca" | "Jan";

export type CostInput = {
  id: string;
  area: string;
  kind: string;
  description: string;
  status: string;
  date: string;
  amount: number;
  paidBy: string;
  splitMode?: string | null;
  splitLuca: number;
  splitJan: number;
  source: "fixed" | "trip";
  note?: string | null;
};

export type ExpenseItem = {
  id: string;
  travelDay: string;
  category: string;
  amount: number;
  paidBy: string;
  note: string;
  createdAt: string;
  lucaShare: number;
  janShare: number;
  lucaPaid: number;
  janPaid: number;
  lucaBalance: number;
  isSettlement?: boolean;
};

export type FixedCostView = {
  area: string;
  kind: string;
  description: string;
  status: string;
  date: string;
  amount: number;
  paidBy: string;
  lucaShare: number;
  janShare: number;
  lucaPaid: number;
  janPaid: number;
  lucaBalance: number;
};

export type CategorySummaryItem = {
  name: string;
  total: number;
  open: number;
  lucaPaid: number;
  janPaid: number;
  lucaShare: number;
  janShare: number;
  lucaBalance: number;
};

export type DashboardState = {
  totalBudget: number;
  openAmount: number;
  consideredAmount: number;
  lucaPaid: number;
  janPaid: number;
  lucaShare: number;
  janShare: number;
  lucaBalance: number;
  direction: "luca_an_jan" | "jan_an_luca" | "ausgeglichen";
  settlementText: string;
  settlementAmount: number;
  fix: {
    amount: number;
    lucaPaid: number;
    janPaid: number;
    lucaBalance: number;
  };
  onTrip: {
    amount: number;
    lucaPaid: number;
    janPaid: number;
    lucaBalance: number;
  };
};

export type CostState = {
  dashboard: DashboardState;
  categorySummary: CategorySummaryItem[];
  fixedCosts: FixedCostView[];
  expenses: ExpenseItem[];
};

type Contribution = {
  id: string;
  category: string;
  amount: number;
  open: number;
  lucaPaid: number;
  janPaid: number;
  lucaShare: number;
  janShare: number;
  lucaBalance: number;
  source: "fixed" | "trip";
  isSettlement: boolean;
};

function cents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeShare(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  if (value > 1) return value / 100;
  return value;
}

function paidParts(amount: number, paidBy: string, splitLuca: number, splitJan: number) {
  if (paidBy === "Luca") return { lucaPaid: amount, janPaid: 0, open: 0 };
  if (paidBy === "Jan") return { lucaPaid: 0, janPaid: amount, open: 0 };
  if (paidBy === "Direkt geteilt") {
    return {
      lucaPaid: cents(amount * splitLuca),
      janPaid: cents(amount * splitJan),
      open: 0,
    };
  }

  return { lucaPaid: 0, janPaid: 0, open: amount };
}

function isSettlementPayment(cost: CostInput) {
  if (cost.source !== "trip") return false;
  const text = `${cost.area} ${cost.kind} ${cost.splitMode ?? ""} ${cost.note ?? ""}`.toLowerCase();
  return text.includes("ausgleichzahlung") || text.includes("ausgleichszahlung") || text.includes("settlement");
}

function isSettlementOffset(cost: CostInput) {
  return (cost.splitMode ?? "").toLowerCase().includes("gegenbuchung");
}

function contributionFor(cost: CostInput): Contribution {
  const amount = cents(cost.amount || 0);
  const settlement = isSettlementPayment(cost);
  const splitLuca = normalizeShare(cost.splitLuca, 0.5);
  const splitJan = normalizeShare(cost.splitJan, 1 - splitLuca);
  const { lucaPaid, janPaid, open } = paidParts(amount, cost.paidBy, splitLuca, splitJan);
  const assigned = open === 0;
  const lucaShare = assigned ? cents(amount * splitLuca) : 0;
  const janShare = assigned ? cents(amount * splitJan) : 0;

  return {
    id: cost.id,
    category: cost.area,
    amount,
    open,
    lucaPaid: cents(lucaPaid),
    janPaid: cents(janPaid),
    lucaShare,
    janShare,
    lucaBalance: cents(lucaPaid - lucaShare),
    source: cost.source,
    isSettlement: settlement,
  };
}

export function calculateCostState(fixedInputs: CostInput[], tripInputs: CostInput[]): CostState {
  const fixedContributions = fixedInputs.map(contributionFor);
  const tripContributions = tripInputs.map(contributionFor);
  const contributions = [...fixedContributions, ...tripContributions];

  const total = contributions.reduce(
    (sum, item) => {
      sum.totalBudget += item.amount;
      sum.openAmount += item.open;
      sum.consideredAmount += item.open === 0 ? item.amount : 0;
      sum.lucaPaid += item.lucaPaid;
      sum.janPaid += item.janPaid;
      sum.lucaShare += item.lucaShare;
      sum.janShare += item.janShare;
      sum.lucaBalance += item.lucaBalance;
      return sum;
    },
    {
      totalBudget: 0,
      openAmount: 0,
      consideredAmount: 0,
      lucaPaid: 0,
      janPaid: 0,
      lucaShare: 0,
      janShare: 0,
      lucaBalance: 0,
    },
  );

  const byCategory = new Map<string, CategorySummaryItem>();
  for (const item of contributions) {
    if (item.isSettlement) continue;
    const current =
      byCategory.get(item.category) ??
      {
        name: item.category,
        total: 0,
        open: 0,
        lucaPaid: 0,
        janPaid: 0,
        lucaShare: 0,
        janShare: 0,
        lucaBalance: 0,
      };

    current.total += item.amount;
    current.open += item.open;
    current.lucaPaid += item.lucaPaid;
    current.janPaid += item.janPaid;
    current.lucaShare += item.lucaShare;
    current.janShare += item.janShare;
    current.lucaBalance += item.lucaBalance;
    byCategory.set(item.category, current);
  }

  const categorySummary = Array.from(byCategory.values()).map((item) => ({
    ...item,
    total: cents(item.total),
    open: cents(item.open),
    lucaPaid: cents(item.lucaPaid),
    janPaid: cents(item.janPaid),
    lucaShare: cents(item.lucaShare),
    janShare: cents(item.janShare),
    lucaBalance: cents(item.lucaBalance),
  }));

  const fixedCosts = fixedInputs.map((cost) => {
    const computed = contributionFor(cost);
    return {
      area: cost.area,
      kind: cost.kind,
      description: cost.description,
      status: cost.status,
      date: cost.date,
      amount: computed.amount,
      paidBy: cost.paidBy,
      lucaShare: computed.lucaShare,
      janShare: computed.janShare,
      lucaPaid: computed.lucaPaid,
      janPaid: computed.janPaid,
      lucaBalance: computed.lucaBalance,
    };
  });

  const expenses = tripInputs.filter((cost) => !isSettlementOffset(cost)).map((cost) => {
    const computed = contributionFor(cost);
    return {
      id: cost.id,
      travelDay: cost.date,
      category: cost.area,
      amount: computed.amount,
      paidBy: cost.paidBy,
      note: cost.note ?? "",
      createdAt: cost.description,
      lucaShare: computed.lucaShare,
      janShare: computed.janShare,
      lucaPaid: computed.lucaPaid,
      janPaid: computed.janPaid,
      lucaBalance: computed.lucaBalance,
      isSettlement: computed.isSettlement,
    };
  });

  const fix = fixedContributions.reduce(
    (sum, item) => {
      sum.amount += item.amount;
      sum.lucaPaid += item.lucaPaid;
      sum.janPaid += item.janPaid;
      sum.lucaBalance += item.lucaBalance;
      return sum;
    },
    { amount: 0, lucaPaid: 0, janPaid: 0, lucaBalance: 0 },
  );

  const onTrip = tripContributions.reduce(
    (sum, item) => {
      sum.amount += item.amount;
      sum.lucaPaid += item.lucaPaid;
      sum.janPaid += item.janPaid;
      sum.lucaBalance += item.lucaBalance;
      return sum;
    },
    { amount: 0, lucaPaid: 0, janPaid: 0, lucaBalance: 0 },
  );

  const lucaBalance = cents(total.lucaBalance);
  const direction =
    lucaBalance < 0 ? "luca_an_jan" : lucaBalance > 0 ? "jan_an_luca" : "ausgeglichen";
  const settlementAmount = cents(Math.abs(lucaBalance));
  const settlementText =
    direction === "luca_an_jan"
      ? "Luca zahlt an Jan"
      : direction === "jan_an_luca"
        ? "Jan zahlt an Luca"
        : "Ausgeglichen";

  return {
    dashboard: {
      totalBudget: cents(total.totalBudget),
      openAmount: cents(total.openAmount),
      consideredAmount: cents(total.consideredAmount),
      lucaPaid: cents(total.lucaPaid),
      janPaid: cents(total.janPaid),
      lucaShare: cents(total.lucaShare),
      janShare: cents(total.janShare),
      lucaBalance,
      direction,
      settlementText,
      settlementAmount,
      fix: {
        amount: cents(fix.amount),
        lucaPaid: cents(fix.lucaPaid),
        janPaid: cents(fix.janPaid),
        lucaBalance: cents(fix.lucaBalance),
      },
      onTrip: {
        amount: cents(onTrip.amount),
        lucaPaid: cents(onTrip.lucaPaid),
        janPaid: cents(onTrip.janPaid),
        lucaBalance: cents(onTrip.lucaBalance),
      },
    },
    categorySummary,
    fixedCosts,
    expenses,
  };
}
