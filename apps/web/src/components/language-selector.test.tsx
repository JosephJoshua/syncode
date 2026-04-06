import '@testing-library/jest-dom/vitest';
import type { SupportedLanguage } from '@syncode/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LanguageSelector } from './language-selector';
import { getLanguageSelectorOption } from './language-selector.data';

const EXPECTED_LANGUAGE_ORDER = [
  'Python',
  'JavaScript',
  'TypeScript',
  'Java',
  'C++',
  'C',
  'Go',
  'Rust',
];

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEvent extends MouseEvent {}

    window.PointerEvent = PointerEvent as typeof window.PointerEvent;
  }

  if (typeof window.ResizeObserver === 'undefined') {
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    window.ResizeObserver = ResizeObserver;
  }

  if (typeof window.DOMRect.fromRect === 'undefined') {
    window.DOMRect.fromRect = ({ x = 0, y = 0, width = 0, height = 0 } = {}) =>
      new window.DOMRect(x, y, width, height);
  }

  if (typeof HTMLElement.prototype.scrollIntoView === 'undefined') {
    HTMLElement.prototype.scrollIntoView = () => {};
  }

  if (typeof HTMLElement.prototype.hasPointerCapture === 'undefined') {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }

  if (typeof HTMLElement.prototype.releasePointerCapture === 'undefined') {
    HTMLElement.prototype.releasePointerCapture = () => {};
  }
});

afterEach(() => {
  cleanup();
});

describe('LanguageSelector', () => {
  it('renders all shared languages in canonical order by default', async () => {
    const user = userEvent.setup();

    render(<LanguageSelector value="typescript" onValueChange={vi.fn()} />);

    await user.click(screen.getByLabelText('Programming language'));

    expect(
      screen.getAllByRole('option').map((option) => option.getAttribute('aria-label')),
    ).toEqual(EXPECTED_LANGUAGE_ORDER);
  });

  it('renders svg icons for every shared language and maps cpp to the cplusplus asset', async () => {
    const user = userEvent.setup();

    render(<LanguageSelector value="cpp" onValueChange={vi.fn()} />);

    const trigger = screen.getByLabelText('Programming language');
    const triggerImage = trigger.querySelector('img');

    expect(triggerImage).not.toBeNull();
    expect(triggerImage).toHaveAttribute('src', getLanguageSelectorOption('cpp').iconSrc);

    await user.click(trigger);

    const optionImages = screen
      .getAllByRole('option')
      .map((option) => option.querySelector('img'))
      .filter((image): image is HTMLImageElement => image instanceof HTMLImageElement);

    expect(optionImages).toHaveLength(8);
    expect(optionImages.map((image) => image.getAttribute('src'))).toEqual(
      EXPECTED_LANGUAGE_ORDER.map((label) => {
        const option = {
          Python: 'python',
          JavaScript: 'javascript',
          TypeScript: 'typescript',
          Java: 'java',
          'C++': 'cpp',
          C: 'c',
          Go: 'go',
          Rust: 'rust',
        }[label] as SupportedLanguage;

        return getLanguageSelectorOption(option).iconSrc;
      }),
    );
  });

  it('calls onValueChange and reflects the selected value after controlled rerender', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <LanguageSelector value="typescript" onValueChange={onValueChange} />,
    );

    await user.click(screen.getByLabelText('Programming language'));
    await user.click(screen.getByRole('option', { name: 'Python' }));

    expect(onValueChange).toHaveBeenCalledWith('python');

    rerender(<LanguageSelector value="python" onValueChange={onValueChange} />);

    expect(screen.getByLabelText('Programming language')).toHaveTextContent('Python');
  });

  it('stays inert when disabled', async () => {
    const user = userEvent.setup();

    render(<LanguageSelector value="python" onValueChange={vi.fn()} disabled />);

    const trigger = screen.getByLabelText('Programming language');

    expect(trigger).toBeDisabled();

    await user.click(trigger);

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('supports parent-provided subsets while preserving canonical shared order', async () => {
    const user = userEvent.setup();
    const subset: readonly SupportedLanguage[] = ['go', 'python', 'rust'];

    render(<LanguageSelector value="python" onValueChange={vi.fn()} languages={subset} />);

    await user.click(screen.getByLabelText('Programming language'));

    expect(
      screen.getAllByRole('option').map((option) => option.getAttribute('aria-label')),
    ).toEqual(['Python', 'Go', 'Rust']);
    expect(
      screen
        .getAllByRole('option')
        .map((option) => option.querySelector('img')?.getAttribute('src')),
    ).toEqual([
      getLanguageSelectorOption('python').iconSrc,
      getLanguageSelectorOption('go').iconSrc,
      getLanguageSelectorOption('rust').iconSrc,
    ]);
  });

  it('falls back to placeholder display when the current value is outside the allowed subset', () => {
    render(
      <LanguageSelector
        value="typescript"
        onValueChange={vi.fn()}
        languages={['python', 'rust']}
        placeholder="Choose a language"
      />,
    );

    expect(screen.getByLabelText('Programming language')).toHaveTextContent('Choose a language');
  });

  it('disables itself and shows an empty-state placeholder when no languages are available', () => {
    render(
      <LanguageSelector
        value={undefined}
        onValueChange={vi.fn()}
        languages={[]}
        placeholder="Choose a language"
      />,
    );

    const trigger = screen.getByLabelText('Programming language');

    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent('No languages available');
  });
});
