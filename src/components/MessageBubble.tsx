import { View, Text, StyleSheet } from 'react-native';

interface Props { content: string; isMine: boolean; createdAt: string; }

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ content, isMine, createdAt }: Props) {
  return (
    <View style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapTheirs]}>
      <View style={[styles.bubble, isMine ? styles.mine : styles.theirs]} accessibilityLabel={`${isMine ? 'You' : 'Them'}: ${content}`}>
        <Text style={[styles.text, isMine ? styles.textMine : styles.textTheirs]}>{content}</Text>
        <Text style={styles.time}>{formatTime(createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginBottom: 8 },
  wrapMine: { alignItems: 'flex-end' },
  wrapTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  mine: { backgroundColor: '#66fcf1', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: '#111217', borderBottomLeftRadius: 4 },
  text: { fontSize: 14, lineHeight: 20 },
  textMine: { color: '#0b0c10' },
  textTheirs: { color: '#eaeaea' },
  time: { fontSize: 10, color: 'rgba(0,0,0,0.4)', alignSelf: 'flex-end' },
});
