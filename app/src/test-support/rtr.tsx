// Test yardımcıları (react-test-renderer). Üretim koduna girmez; yalnızca testlerden içe aktarılır.
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

export function texts(node: ReactTestInstance): string {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string): void => {
    if (typeof n === 'string') out.push(n);
    else n.children.forEach(walk);
  };
  walk(node);
  return out.join(' ').replace(/\s+/g, ' ');
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Tam eşleşme ya da seçenek harfli ("A daha yüksek") eşleşme. */
export const matches = (text: string, label: string): boolean =>
  text.trim() === label || new RegExp(`^[A-D] ${escape(label)}$`).test(text.trim());

export function pressables(r: ReactTestRenderer, label: string): ReactTestInstance[] {
  return r.root.findAll(
    (n) => typeof n.props.onPress === 'function' && !n.props.disabled && matches(texts(n), label),
  );
}

export const has = (r: ReactTestRenderer, label: string): boolean => pressables(r, label).length > 0;

export function press(r: ReactTestRenderer, label: string): void {
  const hit = pressables(r, label);
  if (!hit.length) throw new Error(`öğe yok: "${label}"\n${texts(r.root)}`);
  act(() => void hit[0].props.onPress());
}

export const screenText = (r: ReactTestRenderer): string => texts(r.root);

export async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await act(async () => void (await Promise.resolve()));
}

export { act, create };
export type { ReactTestRenderer };
