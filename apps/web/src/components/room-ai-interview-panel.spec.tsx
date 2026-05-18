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
      />,
    );
    expect(screen.getByText('Hello interviewer')).toBeInTheDocument();
    expect(screen.getByText('Tell me about your approach.')).toBeInTheDocument();
  });

  it('GIVEN isLoading WHEN rendered THEN shows sending indicator', () => {
    render(
      <RoomAiInterviewPanel
        messages={[]}
        isLoading={true}
        error={null}
        onSendMessage={vi.fn()}
        canSendMessage={true}
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
      />,
    );
    expect(screen.getByText('L3')).toBeInTheDocument();
    expect(screen.getByText('Off-by-one error here.')).toBeInTheDocument();
  });
});
