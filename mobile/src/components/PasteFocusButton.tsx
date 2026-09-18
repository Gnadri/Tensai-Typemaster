import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type PasteFocusButtonProps = {
  disabled: boolean;
  onImport: (text: string) => Promise<string>;
};

export function PasteFocusButton({ disabled, onImport }: PasteFocusButtonProps) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const importing = useRef(false);
  const clipboardRead = useRef(0);
  const input = useRef<TextInput>(null);

  const paste = async () => {
    const request = ++clipboardRead.current;
    setError('');
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
        throw new Error('Clipboard unavailable');
      }
      const clipboardText = await navigator.clipboard.readText();
      if (request !== clipboardRead.current) return;
      setText(clipboardText);
      setMessage(clipboardText.trim() ? '' : 'Your clipboard is empty. Paste or type items into the box.');
    } catch {
      if (request !== clipboardRead.current) return;
      setMessage('Paste into the box using Ctrl+V or your browser\'s Paste command.');
    }
    input.current?.focus();
  };

  const open = () => {
    if (disabled) return;
    setText('');
    setMessage('');
    setError('');
    setVisible(true);
    void paste();
  };

  const submit = async () => {
    if (disabled || importing.current || !text.trim()) return;
    clipboardRead.current += 1;
    importing.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setMessage(await onImport(text));
      setText('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not import Focus items. Please try again.');
    } finally {
      importing.current = false;
      setBusy(false);
    }
  };

  const close = () => {
    if (importing.current) return;
    clipboardRead.current += 1;
    setVisible(false);
  };
  const canImport = !disabled && !busy && Boolean(text.trim());

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Paste to import Focus"
        accessibilityHint={disabled ? 'Finish or stop the current round before importing' : 'Add copied characters to Focus'}
        accessibilityState={{ disabled }}
        {...{ title: disabled ? 'Finish or stop the round to import Focus' : 'Paste to import Focus' }}
        disabled={disabled}
        onPress={open}
        style={({ pressed }) => [s.pasteButton, (disabled || pressed) && s.disabled]}
      >
        <Svg width={16} height={16} viewBox="0 0 20 20">
          <Path d="M6 4H4v13h12V4h-2M7 2h6v4H7zM7 10h6M10 7v6" fill="none" stroke={disabled ? '#64748b' : '#93c5fd'} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={s.pasteLabel}>Paste Focus</Text>
      </Pressable>
      <Modal transparent animationType="fade" visible={visible} onRequestClose={close}>
        <View style={s.overlay}>
          <View style={s.panel}>
            <View style={s.header}>
              <Text accessibilityRole="header" style={s.title}>Paste to import Focus</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close Focus import" onPress={close} disabled={busy} style={s.button}>
                <Text style={s.buttonText}>Close</Text>
              </Pressable>
            </View>
            <Text style={s.description}>Paste characters copied from Focus, one item per line. New items will be added to your Focus set.</Text>
            <TextInput
              ref={input}
              accessibilityLabel="Focus items to import"
              multiline
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              editable={!busy}
              value={text}
              onChangeText={value => { clipboardRead.current += 1; setText(value); setError(''); setMessage(''); }}
              placeholder="Paste kana or kanji here"
              placeholderTextColor="#64748b"
              style={s.input}
            />
            {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
            {message ? <Text accessibilityLiveRegion="polite" style={s.message}>{message}</Text> : null}
            <View style={s.actions}>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void paste()} style={[s.button, busy && s.disabled]}>
                <Text style={s.buttonText}>Paste from clipboard</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canImport }} disabled={!canImport} onPress={() => void submit()} style={[s.button, s.primary, !canImport && s.disabled]}>
                <Text style={s.primaryText}>{busy ? 'Importing...' : 'Add to Focus'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  pasteButton: { minHeight: 36, flexDirection: 'row', gap: 7, paddingHorizontal: 13, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: '#3b4b62', backgroundColor: '#1c2a3f' },
  pasteLabel: { fontSize: 12, fontWeight: '600', color: '#dbe5f3' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(2, 6, 23, 0.78)' },
  panel: { width: '100%', maxWidth: 520, maxHeight: '95%', gap: 16, padding: 24, backgroundColor: '#0f172a', borderColor: '#334155', borderWidth: 1, borderRadius: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1, color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  description: { color: '#94a3b8', fontSize: 14, lineHeight: 21 },
  input: { minHeight: 150, maxHeight: 240, flexShrink: 1, borderWidth: 1, borderColor: '#475569', borderRadius: 10, backgroundColor: '#020617', padding: 12, color: '#f8fafc', fontSize: 18, lineHeight: 26, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 },
  button: { borderWidth: 1, borderColor: '#475569', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  buttonText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  primary: { borderColor: '#60a5fa', backgroundColor: '#2563eb' },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  error: { color: '#fca5a5', fontSize: 13, lineHeight: 20 },
  message: { color: '#93c5fd', fontSize: 13, lineHeight: 20 },
});
