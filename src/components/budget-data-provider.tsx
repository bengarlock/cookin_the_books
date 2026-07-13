"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from "react";

import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";
import type { BudgetItem } from "@/lib/budget-item-types";
import type { CreditCardTransaction } from "@/lib/credit-card-transaction-types";
import type { ExpenseCategory } from "@/lib/expense-category-types";
import type { ExpenseEntry } from "@/lib/expense-entry-types";
import type { IncomeEntry } from "@/lib/income-entry-types";
import type { PendingTransaction } from "@/lib/pending-transaction-types";

type BudgetDataContextValue = {
  budgetItems: BudgetItem[];
  setBudgetItems: Dispatch<SetStateAction<BudgetItem[]>>;
  expenseEntries: ExpenseEntry[];
  setExpenseEntries: Dispatch<SetStateAction<ExpenseEntry[]>>;
  creditCardTransactions: CreditCardTransaction[];
  setCreditCardTransactions: Dispatch<SetStateAction<CreditCardTransaction[]>>;
  incomeEntries: IncomeEntry[];
  setIncomeEntries: Dispatch<SetStateAction<IncomeEntry[]>>;
  expenseCategories: ExpenseCategory[];
  setExpenseCategories: Dispatch<SetStateAction<ExpenseCategory[]>>;
  pendingTransactions: PendingTransaction[];
  setPendingTransactions: Dispatch<SetStateAction<PendingTransaction[]>>;
  budgetPlanSettings: BudgetPlanSettings;
  setBudgetPlanSettings: Dispatch<SetStateAction<BudgetPlanSettings>>;
};

const BudgetDataContext = createContext<BudgetDataContextValue | null>(null);

export function BudgetDataProvider({
  children,
  initialBudgetItems,
  initialExpenseEntries,
  initialCreditCardTransactions,
  initialExpenseCategories,
  initialIncomeEntries,
  initialPendingTransactions,
  initialBudgetPlanSettings,
}: {
  children: ReactNode;
  initialBudgetItems: BudgetItem[];
  initialExpenseEntries: ExpenseEntry[];
  initialCreditCardTransactions: CreditCardTransaction[];
  initialExpenseCategories: ExpenseCategory[];
  initialIncomeEntries: IncomeEntry[];
  initialPendingTransactions: PendingTransaction[];
  initialBudgetPlanSettings: BudgetPlanSettings;
}) {
  const [budgetItems, setBudgetItems] = useState(initialBudgetItems);
  const [expenseEntries, setExpenseEntries] = useState(initialExpenseEntries);
  const [creditCardTransactions, setCreditCardTransactions] = useState(
    initialCreditCardTransactions,
  );
  const [incomeEntries, setIncomeEntries] = useState(initialIncomeEntries);
  const [expenseCategories, setExpenseCategories] = useState(initialExpenseCategories);
  const [pendingTransactions, setPendingTransactions] = useState(
    initialPendingTransactions,
  );
  const [budgetPlanSettings, setBudgetPlanSettings] = useState(
    initialBudgetPlanSettings,
  );

  return (
    <BudgetDataContext.Provider
      value={{
        budgetItems,
        setBudgetItems,
        expenseEntries,
        setExpenseEntries,
        creditCardTransactions,
        setCreditCardTransactions,
        incomeEntries,
        setIncomeEntries,
        expenseCategories,
        setExpenseCategories,
        pendingTransactions,
        setPendingTransactions,
        budgetPlanSettings,
        setBudgetPlanSettings,
      }}
    >
      {children}
    </BudgetDataContext.Provider>
  );
}

export function useBudgetData() {
  const value = useContext(BudgetDataContext);
  if (!value) {
    throw new Error("useBudgetData must be used within BudgetDataProvider.");
  }
  return value;
}

export function useOptionalBudgetData() {
  return useContext(BudgetDataContext);
}
