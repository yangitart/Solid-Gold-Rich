import React from 'react';
import { StyleSheet, View } from 'react-native';
import AuroraBackground from '../components/AuroraBackground';
import GoldDust from '../components/GoldDust';
import BootScreen from './BootScreen';
import RichScreen from './RichScreen';
import { C } from '../theme/luxury';

// The background is mounted once so the transition from loading to the card
// stays continuous and the ambient animation never restarts.
export default function AppRoot() {
  const [booted, setBooted] = React.useState(false);
  const onDone = React.useCallback(() => setBooted(true), []);

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <GoldDust />
      {booted ? <RichScreen /> : <BootScreen onDone={onDone} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
});
