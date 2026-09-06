import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { AppState as FinanceState } from '@/domain/AppState';
import type { EmergencyBackup } from '@/features/backup/application/ports/EmergencyBackup';

export const emergencyBackup: EmergencyBackup = {
  share: async (state: FinanceState) => {
    const file = new File(Paths.cache, `solid-gold-rich-backup-${new Date().toISOString().slice(0, 10)}.json`);
    file.create({ overwrite: true });
    file.write(JSON.stringify(state, null, 2));
    if (!await Sharing.isAvailableAsync()) throw new Error('sharing-unavailable');
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
  },
};
