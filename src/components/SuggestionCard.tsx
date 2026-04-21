import { View, Text, StyleSheet } from 'react-native';

interface Props { icon: string; title: string; body: string; }

export default function SuggestionCard({ icon, title, body }: Props) {
  return (
    <View style={styles.card} accessibilityLabel={`AI suggestion: ${title}. ${body}`}>
      <Text style={styles.icon} accessibilityElementsHidden>{icon}</Text>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111217', borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderColor: '#1e2028' },
  icon: { fontSize: 26, marginTop: 2 },
  textWrap: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: '600', color: '#eaeaea' },
  body: { fontSize: 13, color: '#8a8f98', lineHeight: 18 },
});
