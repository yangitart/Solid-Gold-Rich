import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { EmergencyBackup } from '@/application/ports/EmergencyBackup';
import type { FinanceState } from '@/features/finance/domain/entities/financeTypes';

export const emergencyBackup: EmergencyBackup = {
  share: async (state: FinanceState) => {
    const file = new File(Paths.cache, `solid-gold-rich-backup-${new Date().toISOString().slice(0, 10)}.json`);
    file.create({ overwrite: true });
    file.write(JSON.stringify(state, null, 2));
    if (!await Sharing.isAvailableAsync()) throw new Error('sharing-unavailable');
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
  },
};
