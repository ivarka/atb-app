import { StyleSheet } from 'react-native';
export const colors = { ink: '#183B35', muted: '#65756F', paper: '#F6F7F3', white: '#FFFFFF', border: '#E1E7DE', green: '#246A4C', lime: '#D9EF9F', soft: '#EDF3E8', amber: '#8A571E', amberBg: '#FFF4E3', red: '#A13E34', redBg: '#FFF0EC', blue: '#405D76', blueBg: '#EEF3F8' };
export const s = StyleSheet.create({
  text: { fontSize: 15, color: colors.ink, lineHeight: 23 }, muted: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  label: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { fontSize: 23, fontWeight: '600', color: colors.ink, letterSpacing: -0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 24 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
});
