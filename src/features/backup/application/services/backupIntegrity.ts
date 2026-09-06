function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function uniqueRecords(value: unknown) {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((item) => {
    if (!record(item) || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id))
      return false;
    ids.add(item.id);
    return true;
  });
}

// Imported data must not lose records silently during normalization. Local loading
// keeps its historical, tolerant migrations; file imports reject ambiguous IDs.
export function hasStoreImportIntegrity(value: unknown, allowMissingCollections = false) {
  if (!record(value)) return false;
  return (
    [
      'categories',
      'products',
      'stockMovements',
      'sales',
      'clients',
      'employees',
      'cashMovements',
    ].every(
      (key) => (allowMissingCollections && value[key] === undefined) || uniqueRecords(value[key]),
    ) &&
    (value.providers === undefined || uniqueRecords(value.providers))
  );
}

export function hasFinanceImportIntegrity(value: unknown) {
  if (!record(value) || !uniqueRecords(value.accounts) || !uniqueRecords(value.transactions))
    return false;
  const accounts = value.accounts as Record<string, unknown>[];
  if (
    !accounts.every(
      (item) =>
        (item.currency === undefined ||
          (typeof item.currency === 'string' && /^[A-Za-z]{3}$/.test(item.currency))) &&
        (item.openingBalance === undefined ||
          (typeof item.openingBalance === 'number' && Number.isFinite(item.openingBalance))),
    )
  )
    return false;
  const ids = new Set(accounts.map((item) => item.id));
  if (
    !(value.transactions as Record<string, unknown>[]).every(
      (item) =>
        ids.has(item.accountId) &&
        typeof item.currency === 'string' &&
        /^[A-Za-z]{3}$/.test(item.currency) &&
        typeof item.amount === 'number' &&
        Number.isFinite(item.amount) &&
        ['income', 'expense', 'transfer', 'adjustment'].includes(String(item.kind)) &&
        (item.kind === 'adjustment' || item.amount >= 0) &&
        typeof item.date === 'string' &&
        Number.isFinite(Date.parse(item.date)),
    )
  )
    return false;
  if (
    ![
      'transfers',
      'budgets',
      'recurring',
      'debts',
      'savingsGoals',
      'reminders',
      'notes',
      'noteFolders',
    ].every((key) => value[key] === undefined || uniqueRecords(value[key]))
  )
    return false;
  return (
    value.store === undefined ||
    hasStoreImportIntegrity(value.store, Number(value.schemaVersion) < 7)
  );
}
