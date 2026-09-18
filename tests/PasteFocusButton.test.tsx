import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { PasteFocusButton } from '../mobile/src/components/PasteFocusButton';

jest.mock('react-native', () => ({
  Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View',
  Platform: { OS: 'web', select: (options: any) => options.web ?? options.default },
  StyleSheet: { create: (styles: any) => styles },
}));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path' }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
let tree: renderer.ReactTestRenderer;
const clipboard = (readText: () => Promise<string>) => Object.defineProperty(globalThis, 'navigator', {
  configurable: true, value: { clipboard: { readText } },
});
const mount = async (onImport = jest.fn().mockResolvedValue('Added 1 item to Focus.'), disabled = false) => {
  await act(async () => { tree = renderer.create(<PasteFocusButton disabled={disabled} onImport={onImport} />); });
  return onImport;
};
const button = (label: string) => tree.root.findAllByType('Pressable' as any).find(node =>
  node.props.accessibilityLabel === label || node.findAllByType('Text' as any).some(text => text.props.children === label),
)!;
const field = () => tree.root.findByType('TextInput' as any);

afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
afterAll(() => {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete (globalThis as any).navigator;
});

test('clipboard permission failure leaves a usable manual paste flow', async () => {
  clipboard(async () => { throw new Error('Permission denied'); });
  const onImport = await mount();
  await act(async () => button('Paste to import Focus').props.onPress());
  expect(tree.root.findByType('Modal' as any).props.visible).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('Ctrl+V');
  await act(async () => field().props.onChangeText('日'));
  await act(async () => button('Add to Focus').props.onPress());
  expect(onImport).toHaveBeenCalledWith('日');
  expect(field().props.value).toBe('');
  expect(JSON.stringify(tree.toJSON())).toContain('Added 1 item to Focus.');
});

test('failed validation preserves the pasted text and displays the error', async () => {
  clipboard(async () => 'unrecognized');
  await mount(jest.fn().mockRejectedValue(new Error('Nothing was imported.')));
  await act(async () => button('Paste to import Focus').props.onPress());
  await act(async () => button('Add to Focus').props.onPress());
  expect(field().props.value).toBe('unrecognized');
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('Nothing was imported.');
});

test('late clipboard reads cannot overwrite text already edited by the user', async () => {
  let resolveRead: (value: string) => void = () => {};
  clipboard(() => new Promise(resolve => { resolveRead = resolve; }));
  await mount();
  await act(async () => button('Paste to import Focus').props.onPress());
  await act(async () => field().props.onChangeText('月'));
  await act(async () => resolveRead('日'));
  expect(field().props.value).toBe('月');
});

test('running or paused rounds cannot open the import dialog', async () => {
  const readText = jest.fn().mockResolvedValue('日');
  clipboard(readText);
  await mount(undefined, true);
  await act(async () => button('Paste to import Focus').props.onPress());
  expect(button('Paste to import Focus').props.disabled).toBe(true);
  expect(tree.root.findByType('Modal' as any).props.visible).toBe(false);
  expect(readText).not.toHaveBeenCalled();
});
