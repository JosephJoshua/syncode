import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

import { RoomAiInterviewPanel } from './room-ai-interview-panel.js';

describe('RoomAiInterviewPanel', () => {
  it('GIVEN no messages WHEN rendered THEN shows empty state', () => {
    render(
      <RoomAiInterviewPanel
        messages={[]}
        isLoading={false}
        error={null}
        onSendMessage={vi.fn()}
        canSendMessage={true}
        currentUser={null}
      />,
    );
    expect(screen.getByText('workspace.aiInterviewEmpty')).toBeInTheDocument();
  });

  it('GIVEN messages WHEN rendered THEN shows user and assistant bubbles', () => {
    render(
      <RoomAiInterviewPanel
        messages={[
          { role: 'user', content: 'Hello interviewer' },
          { role: 'assistant', content: 'Tell me about your approach.' },
        ]}
        isLoading={false}
        error={null}
        onSendMessage={vi.fn()}
        canSendMessage={true}
        currentUser={null}
      />,
    );
    expect(screen.getByText('Hello interviewer')).toBeInTheDocument();
    expect(screen.getByText('Tell me about your approach.')).toBeInTheDocument();
  });

  it('GIVEN current user has an avatar WHEN rendering a user message THEN shows the real avatar', () => {
    const { container } = render(
      <RoomAiInterviewPanel
        messages={[{ role: 'user', content: 'Hello interviewer' }]}
        isLoading={false}
        error={null}
        onSendMessage={vi.fn()}
        canSendMessage={true}
        currentUser={{
          userId: 'user-1',
          username: 'jane',
          displayName: 'Jane Doe',
          avatarUrl: 'https://cdn.example.com/jane.png',
          role: 'candidate',
          isReady: true,
          isActive: true,
        }}
      />,
    );

    expect(container.querySelector('[data-slot="avatar-image"]')).toHaveAttribute(
      'src',
      'https://cdn.example.com/jane.png',
    );
  });

  it('GIVEN isLoading WHEN rendered THEN shows sending indicator', () => {
    render(
      <RoomAiInterviewPanel
        messages={[]}
        isLoading={true}
        error={null}
        onSendMessage={vi.fn()}
        canSendMessage={true}
        currentUser={null}
      />,
    );
    expect(screen.getAllByText('workspace.aiInterviewSending').length).toBeGreaterThan(0);
  });

  it('GIVEN an error WHEN rendered THEN shows error message', () => {
    render(
      <RoomAiInterviewPanel
        messages={[]}
        isLoading={false}
        error="Something went wrong"
        onSendMessage={vi.fn()}
        canSendMessage={true}
        currentUser={null}
      />,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('GIVEN user types and submits WHEN Enter pressed THEN onSendMessage called', async () => {
    const onSend = vi.fn();
    render(
      <RoomAiInterviewPanel
        messages={[]}
        isLoading={false}
        error={null}
        onSendMessage={onSend}
        canSendMessage={true}
        currentUser={null}
      />,
    );
    const textarea = screen.getByPlaceholderText('workspace.aiInterviewPlaceholder');
    await userEvent.type(textarea, 'My answer{Enter}');
    expect(onSend).toHaveBeenCalledWith('My answer');
  });

  it('GIVEN user submits rapidly WHEN send button is double-clicked THEN emits one message', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <RoomAiInterviewPanel
        messages={[]}
        isLoading={false}
        error={null}
        onSendMessage={onSend}
        canSendMessage={true}
        currentUser={null}
      />,
    );

    const textarea = screen.getByPlaceholderText('workspace.aiInterviewPlaceholder');
    await user.type(textarea, 'My answer');
    await user.dblClick(screen.getByRole('button', { name: 'workspace.aiInterviewSend' }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('My answer');
  });

  it('GIVEN assistant message with codeAnnotations WHEN rendered THEN shows annotations', () => {
    render(
      <RoomAiInterviewPanel
        messages={[
          {
            role: 'assistant',
            content: 'Check line 3.',
            codeAnnotations: [{ line: 3, comment: 'Off-by-one error here.' }],
          },
        ]}
        isLoading={false}
        error={null}
        onSendMessage={vi.fn()}
        canSendMessage={true}
        currentUser={null}
      />,
    );
    expect(screen.getByText('L3')).toBeInTheDocument();
    expect(screen.getByText('Off-by-one error here.')).toBeInTheDocument();
  });

  it('GIVEN assistant message with follow-up question WHEN rendered THEN shows follow-up prompt', () => {
    render(
      <RoomAiInterviewPanel
        messages={[
          {
            role: 'assistant',
            content: 'Good direction.',
            followUpQuestion: 'What invariant does the map maintain?',
          },
        ]}
        isLoading={false}
        error={null}
        onSendMessage={vi.fn()}
        canSendMessage={true}
        currentUser={null}
      />,
    );

    expect(screen.getByText('workspace.aiInterviewFollowUp')).toBeInTheDocument();
    expect(screen.getByText('What invariant does the map maintain?')).toBeInTheDocument();
  });

  it('GIVEN assistant message with codeContext WHEN rendered THEN shows line range and snippet', () => {
    render(
      <RoomAiInterviewPanel
        messages={[
          {
            role: 'assistant',
            content: 'Let us focus here.',
            codeContext: {
              language: 'typescript',
              file: 'solution.ts',
              codeSnippet: 'const seen = new Map();',
              startLine: 2,
              endLine: 3,
              questionType: 'data_structure_choice',
              reason: 'Map state matters here.',
            },
          },
        ]}
        isLoading={false}
        error={null}
        onSendMessage={vi.fn()}
        canSendMessage={true}
        currentUser={null}
      />,
    );

    expect(screen.getByText('solution.ts L2-3')).toBeInTheDocument();
    expect(screen.getByText('const seen = new Map();')).toBeInTheDocument();
    expect(
      screen.getByText('workspace.aiInterviewQuestionType.data_structure_choice'),
    ).toBeInTheDocument();
  });

  it('GIVEN speech recognition is available WHEN voice transcript returns THEN fills editable draft', async () => {
    const user = userEvent.setup();
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = 'en-US';
      onresult:
        | ((event: {
            resultIndex: number;
            results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
          }) => void)
        | null = null;
      onerror = null;
      onend: (() => void) | null = null;
      start() {
        this.onresult?.({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: 'spoken answer' } }],
        });
        this.onend?.();
      }
      stop() {}
      abort() {}
    }
    const original = (globalThis as { SpeechRecognition?: unknown }).SpeechRecognition;
    (globalThis as { SpeechRecognition?: unknown }).SpeechRecognition = MockSpeechRecognition;

    try {
      render(
        <RoomAiInterviewPanel
          messages={[]}
          isLoading={false}
          error={null}
          onSendMessage={vi.fn()}
          canSendMessage={true}
          currentUser={null}
        />,
      );

      await user.click(screen.getByTitle('workspace.aiInterviewVoiceInput'));
      const textarea = screen.getByPlaceholderText('workspace.aiInterviewPlaceholder');
      expect(textarea).toHaveValue('spoken answer');

      await user.type(textarea, ' edited');
      expect(textarea).toHaveValue('spoken answer edited');
    } finally {
      (globalThis as { SpeechRecognition?: unknown }).SpeechRecognition = original;
    }
  });

  it('GIVEN speech recognition is available WHEN toggling voice input THEN mic icon reflects off and listening states', async () => {
    const user = userEvent.setup();
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = 'en-US';
      onresult = null;
      onerror = null;
      onend: (() => void) | null = null;
      start() {}
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    const original = (globalThis as { SpeechRecognition?: unknown }).SpeechRecognition;
    (globalThis as { SpeechRecognition?: unknown }).SpeechRecognition = MockSpeechRecognition;

    try {
      const { container } = render(
        <RoomAiInterviewPanel
          messages={[]}
          isLoading={false}
          error={null}
          onSendMessage={vi.fn()}
          canSendMessage={true}
          currentUser={null}
        />,
      );

      const voiceButton = screen.getByTitle('workspace.aiInterviewVoiceInput');
      expect(voiceButton).toHaveAttribute('aria-pressed', 'false');
      expect(container.querySelector('.lucide-mic-off')).toBeInTheDocument();

      await user.click(voiceButton);
      expect(voiceButton).toHaveAttribute('aria-pressed', 'true');
      expect(container.querySelector('.lucide-mic')).toBeInTheDocument();

      await user.click(voiceButton);
      expect(voiceButton).toHaveAttribute('aria-pressed', 'false');
      expect(container.querySelector('.lucide-mic-off')).toBeInTheDocument();
    } finally {
      (globalThis as { SpeechRecognition?: unknown }).SpeechRecognition = original;
    }
  });
});
