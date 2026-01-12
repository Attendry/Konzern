import { AccountBalance } from '../types';

interface BalanceSheetPosition {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity';
  balance: number;
}

export interface BuiltBalanceSheet {
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  assets: {
    fixedAssets: BalanceSheetPosition[];
    currentAssets: BalanceSheetPosition[];
    deferredTaxAssets: BalanceSheetPosition[];
    goodwill: number;
    totalAssets: number;
  };
  liabilities: {
    equity: {
      parentCompany: BalanceSheetPosition[];
      minorityInterests: number;
      totalEquity: number;
    };
    provisions: BalanceSheetPosition[];
    liabilities: BalanceSheetPosition[];
    deferredTaxLiabilities: BalanceSheetPosition[];
    totalLiabilities: number;
  };
  balanceValidation: {
    isBalanced: boolean;
    difference: number;
    errors: string[];
    warnings: string[];
  };
  consolidationSummary?: {
    companiesIncluded: number;
    eliminationsApplied: number;
    totalEliminationAmount: number;
  };
}

/**
 * Builds a balance sheet structure from account balances
 * Similar to how consolidated balance sheet is structured
 */
export function buildBalanceSheetFromBalances(
  balances: AccountBalance[],
  fiscalYear: number,
  periodStart: string,
  periodEnd: string,
): BuiltBalanceSheet {
  // Filter only balance sheet accounts (assets, liabilities, equity)
  const balanceSheetBalances = balances.filter(
    (balance) =>
      balance.account &&
      ['asset', 'liability', 'equity'].includes(balance.account.accountType)
  );

  // Separate by account type
  const assets: BalanceSheetPosition[] = [];
  const liabilities: BalanceSheetPosition[] = [];
  const equity: BalanceSheetPosition[] = [];
  let goodwill = 0;

  for (const balance of balanceSheetBalances) {
    if (!balance.account) continue;

    const position: BalanceSheetPosition = {
      accountId: balance.accountId,
      accountNumber: balance.account.accountNumber,
      accountName: balance.account.name,
      accountType: balance.account.accountType as 'asset' | 'liability' | 'equity',
      balance: Math.abs(Number(balance.balance) || 0),
    };

    if (balance.account.accountType === 'asset') {
      assets.push(position);
      // Identify goodwill (simplified - should come from separate account)
      if (position.accountName.toLowerCase().match(/goodwill|firmenwert|geschäftswert/i)) {
        goodwill += position.balance;
      }
    } else if (balance.account.accountType === 'liability') {
      liabilities.push(position);
    } else if (balance.account.accountType === 'equity') {
      equity.push(position);
    }
  }

  // Group assets according to HGB structure
  // Fixed Assets: typically accounts 0000-0999 or 1000-1499
  const fixedAssets = assets.filter((a) => {
    const accountNum = a.accountNumber;
    const accountName = a.accountName.toLowerCase();
    return (
      accountNum.match(/^0[0-9]{3}/) ||
      accountNum.match(/^1[0-4][0-9]{2}/) || // Accounts 1000-1499
      accountName.match(/anlage|fixed|immobilien|sachanlage/i)
    );
  });

  // Current Assets: typically accounts 1500-2999
  const currentAssets = assets.filter((a) => {
    const accountNum = a.accountNumber;
    const accountName = a.accountName.toLowerCase();
    return (
      (accountNum.match(/^1[5-9][0-9]{2}/) || accountNum.match(/^2[0-9]{3}/)) &&
      !accountName.match(/anlage|fixed|immobilien|sachanlage/i)
    );
  });

  // Deferred Tax Assets
  const deferredTaxAssets = assets.filter((a) =>
    a.accountName.toLowerCase().match(/rechnungsabgrenzung|deferred|aktive rap/i)
  );

  // Group liabilities according to HGB structure
  const provisions = liabilities.filter((a) =>
    a.accountNumber.match(/^2[0-9]{3}/) || a.accountName.toLowerCase().match(/rückstellung|provision/i)
  );
  const otherLiabilities = liabilities.filter(
    (a) =>
      !a.accountNumber.match(/^2[0-9]{3}/) &&
      !a.accountName.toLowerCase().match(/rückstellung|provision/i)
  );
  const deferredTaxLiabilities = liabilities.filter((a) =>
    a.accountName.toLowerCase().match(/rechnungsabgrenzung|deferred/i)
  );

  // Calculate totals
  const totalFixedAssets = fixedAssets.reduce((sum, a) => sum + a.balance, 0);
  const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + a.balance, 0);
  const totalDeferredTaxAssets = deferredTaxAssets.reduce((sum, a) => sum + a.balance, 0);
  const totalAssets = totalFixedAssets + totalCurrentAssets + totalDeferredTaxAssets + goodwill;

  const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);
  const totalProvisions = provisions.reduce((sum, p) => sum + p.balance, 0);
  const totalOtherLiabilities = otherLiabilities.reduce((sum, l) => sum + l.balance, 0);
  const totalDeferredTaxLiabilities = deferredTaxLiabilities.reduce(
    (sum, d) => sum + d.balance,
    0
  );
  const totalLiabilities =
    totalEquity + totalProvisions + totalOtherLiabilities + totalDeferredTaxLiabilities;

  // Validate balance equality
  const difference = Math.abs(totalAssets - totalLiabilities);
  const isBalanced = difference < 0.01; // Tolerance for rounding errors

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isBalanced) {
    errors.push(
      `Bilanzgleichheit verletzt: Aktiva (${totalAssets.toFixed(2)}) ≠ Passiva (${totalLiabilities.toFixed(2)}). Differenz: ${difference.toFixed(2)}`
    );
  } else if (difference > 0) {
    warnings.push(
      `Geringe Bilanzabweichung: ${difference.toFixed(2)} (möglicher Rundungsfehler)`
    );
  }

  return {
    fiscalYear,
    periodStart,
    periodEnd,
    assets: {
      fixedAssets,
      currentAssets,
      deferredTaxAssets,
      goodwill,
      totalAssets,
    },
    liabilities: {
      equity: {
        parentCompany: equity,
        minorityInterests: 0, // No minority interests in individual statements
        totalEquity: totalEquity,
      },
      provisions,
      liabilities: otherLiabilities,
      deferredTaxLiabilities,
      totalLiabilities,
    },
    balanceValidation: {
      isBalanced,
      difference,
      errors,
      warnings,
    },
  };
}
