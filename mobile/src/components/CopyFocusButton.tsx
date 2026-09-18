import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { styles } from '../styles/appStyles';

async function copyText(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Locally opened pages may require the selection-based clipboard API.
    }
  }
  if (typeof document === 'undefined') throw new Error('Clipboard unavailable');
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    if (!document.execCommand('copy')) throw new Error('Clipboard copy failed');
  } finally {
    textarea.remove();
    previouslyFocused?.focus({ preventScroll: true });
  }
}

export function CopyFocusButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const disabled = !text;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  useEffect(() => {
    setCopied(false);
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, [text]);

  const copy = async () => {
    if (disabled) return;
    try {
      await copyText(text);
      if (!mounted.current) return;
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error('Failed to copy Focus characters:', error);
      Alert.alert('Copy failed', 'Could not copy Focus characters. Please try again.');
    }
  };

  const stroke = disabled ? '#64748b' : copied ? '#86efac' : '#93c5fd';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copied ? 'Focus characters copied' : 'Copy Focus characters'}
      accessibilityHint="Copy the entire Focus set, one item per line"
      accessibilityState={{ disabled }}
      accessibilityLiveRegion="polite"
      {...{ title: copied ? 'Copied!' : 'Copy Focus characters' }}
      disabled={disabled}
      onPress={() => void copy()}
      style={({ pressed }) => [
        styles.quizLoopToggleButton,
        copied && styles.quizLoopToggleButtonActive,
        (disabled || pressed) && styles.quizLoopToggleButtonDisabled,
      ]}
    >
      <Svg width={20} height={20} viewBox="0 0 20 20">
        {copied ? (
          <Path d="m4 10 4 4 8-8" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <Path d="M7 7h9v10H7z" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" />
            <Path d="M12 7V3H3v10h4" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" />
          </>
        )}
      </Svg>
    </Pressable>
  );
}
