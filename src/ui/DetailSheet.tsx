import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './components';
import { colors, s } from './theme';

/** A single focused task. Native Modal owns Android back and web Escape/focus trapping. */
export function DetailSheet({ title, onClose, notice, children }: { title: string; onClose: () => void; notice?: React.ReactNode; children: React.ReactNode }) {
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <SafeAreaView testID="detail-sheet" style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, gap: 10 }}>
        <View style={[s.row, { flexWrap: 'wrap' }]}><Button small secondary label="← Tilbake" onPress={onClose} /><Text accessibilityRole="header" style={[s.title, { flexShrink: 1 }]}>{title}</Text></View>
        {notice}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16, width: '100%', maxWidth: 900, alignSelf: 'center' }}>{children}</ScrollView>
    </SafeAreaView>
  </Modal>;
}
