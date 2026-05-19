import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

import {
  isVoiceCaptureStateActive,
  normalizeTranscriptionMimeType,
  RoomAiInterviewPanel,
  resolveRecognitionLanguage,
  resolveVoiceButtonTitle,
  resolveVoicePermissionError,
  resolveVoiceStatusText,
  shouldShowSendingIndicator,
  withTimeout,
} from './room-ai-interview-panel.js';

const t = (key: string) => key;

describe('room-ai-interview-panel helpers', () => {
  it('GIVEN voice capture state WHEN resolving status text THEN requesting/listening/transcribing return keys', () => {
    expect(resolveVoiceStatusText(t, 'idle')).toBeNull();
    expect(resolveVoiceStatusText(t, 'requesting')).toBe('workspace.aiInterviewVoiceRequesting');
    expect(resolveVoiceStatusText(t, 'listening')).toBe('workspace.aiInterviewVoiceListening');
    expect(resolveVoiceStatusText(t, 'transcribing')).toBe(
      'workspace.aiInterviewVoiceTranscribing',
    );
  });

  it('GIVEN voice capture state WHEN checking active flag THEN only non-idle states are active', () => {
    expect(isVoiceCaptureStateActive('idle')).toBe(false);
    expect(isVoiceCaptureStateActive('requesting')).toBe(true);
    expect(isVoiceCaptureStateActive('listening')).toBe(true);
    expect(isVoiceCaptureStateActive('transcribing')).toBe(true);
  });

  it('GIVEN voice support flag WHEN resolving voice button title THEN returns correct title key', () => {
    expect(resolveVoiceButtonTitle(t, true)).toBe('workspace.aiInterviewVoiceInput');
    expect(resolveVoiceButtonTitle(t, false)).toBe('workspace.aiInterviewVoiceUnsupported');
  });

  it('GIVEN loading flags WHEN checking sending indicator visibility THEN only non-initial loading shows indicator', () => {
    expect(shouldShowSendingIndicator(false, false)).toBe(false);
    expect(shouldShowSendingIndicator(true, true)).toBe(false);
    expect(shouldShowSendingIndicator(true, false)).toBe(true);
  });

  it('GIVEN UI language WHEN resolving recognition language THEN maps zh/en and keeps region variants', () => {
    expect(resolveRecognitionLanguage(undefined)).toBe('en-US');
    expect(resolveRecognitionLanguage('zh')).toBe('zh-CN');
    expect(resolveRecognitionLanguage('zh-HK')).toBe('zh-TW');
    expect(resolveRecognitionLanguage('en-GB')).toBe('en-US');
    expect(resolveRecognitionLanguage('fr-CA')).toBe('fr-CA');
    expect(resolveRecognitionLanguage('es')).toBe('es-US');
  });

  it('GIVEN mime types WHEN normalizing for transcription THEN maps aliases and strips codecs suffix', () => {
    expect(normalizeTranscriptionMimeType(undefined)).toBe('audio/webm');
    expect(normalizeTranscriptionMimeType('audio/mp3')).toBe('audio/mpeg');
    expect(normalizeTranscriptionMimeType('audio/x-wav')).toBe('audio/wav');
    expect(normalizeTranscriptionMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
  });

  it('GIVEN microphone permission result WHEN resolving error message THEN returns expected key', () => {
    expect(resolveVoicePermissionError(t, 'denied')).toBe(
      'workspace.aiInterviewVoicePermissionDenied',
    );
    expect(resolveVoicePermissionError(t, 'no_device')).toBe('workspace.aiInterviewVoiceNoDevice');
    expect(resolveVoicePermissionError(t, 'unavailable')).toBe('workspace.aiInterviewVoiceError');
  });

  it('GIVEN a promise and timeout WHEN promise resolves first THEN withTimeout resolves value', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100, () => new Error('timeout'))).resolves.toBe(
      'ok',
    );
  });

  it('GIVEN a promise and timeout WHEN timeout elapses first THEN withTimeout rejects', async () => {
    vi.useFakeTimers();
    try {
      const never = new Promise<string>(() => {
        // intentionally unresolved
      });
      const pending = withTimeout(never, 10, () => new Error('timeout'));
      const assertion = expect(pending).rejects.toThrow('timeout');
      await vi.advanceTimersByTimeAsync(10);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

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

  it('GIVEN current user avatar WHEN rendering user message THEN shows avatar image', () => {
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

  it('GIVEN initial loading state WHEN rendered THEN shows preparing indicator', () => {
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
    expect(screen.getByText('workspace.aiInterviewBusy')).toBeInTheDocument();
  });

  it('GIVEN loading with existing messages WHEN rendered THEN shows sending indicator', () => {
    render(
      <RoomAiInterviewPanel
        messages={[{ role: 'assistant', content: 'Let us begin.' }]}
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

  it('GIVEN user types and presses Enter WHEN not loading THEN sends message once', async () => {
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

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('My answer');
  });

  it('GIVEN double click on send WHEN draft exists THEN only one message is emitted', async () => {
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

  it('GIVEN assistant follow-up and annotations WHEN rendered THEN shows both', () => {
    render(
      <RoomAiInterviewPanel
        messages={[
          {
            role: 'assistant',
            content: 'Check line 3.',
            followUpQuestion: 'What invariant does the map maintain?',
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

    expect(screen.getByText('workspace.aiInterviewFollowUp')).toBeInTheDocument();
    expect(screen.getByText('What invariant does the map maintain?')).toBeInTheDocument();
    expect(screen.getByText('L3')).toBeInTheDocument();
    expect(screen.getByText('Off-by-one error here.')).toBeInTheDocument();
  });

  it('GIVEN code context message WHEN rendered THEN shows context card and line range', () => {
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

  it('GIVEN recorder + transcription callback WHEN user records and stops THEN transcript is auto-sent', async () => {
    const user = userEvent.setup();
    const restoreMediaRecorder = installMediaRecorderMock();
    const restoreMediaDevices = installMediaDevicesMock();
    const onSendMessage = vi.fn();
    const onTranscribeVoiceInput = vi.fn().mockResolvedValue('transcribed backend text');

    try {
      render(
        <RoomAiInterviewPanel
          messages={[]}
          isLoading={false}
          error={null}
          onSendMessage={onSendMessage}
          onTranscribeVoiceInput={onTranscribeVoiceInput}
          canSendMessage={true}
          currentUser={null}
        />,
      );

      const voiceButton = screen.getByTitle('workspace.aiInterviewVoiceInput');
      await user.click(voiceButton);
      expect(screen.getByText('workspace.aiInterviewVoiceListening')).toBeInTheDocument();

      await user.click(voiceButton);

      await waitFor(() => {
        expect(onTranscribeVoiceInput).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(onSendMessage).toHaveBeenCalledWith('transcribed backend text');
      });

      expect(screen.getByPlaceholderText('workspace.aiInterviewPlaceholder')).toBeInTheDocument();
    } finally {
      restoreMediaRecorder();
      restoreMediaDevices();
    }
  });

  it('GIVEN in-flight transcription WHEN recorder stops THEN transcribing state is shown', async () => {
    const user = userEvent.setup();
    const restoreMediaRecorder = installMediaRecorderMock();
    const restoreMediaDevices = installMediaDevicesMock();
    const onTranscribeVoiceInput = vi.fn(
      () =>
        new Promise<string>(() => {
          // keep pending for state assertion
        }),
    );

    try {
      render(
        <RoomAiInterviewPanel
          messages={[]}
          isLoading={false}
          error={null}
          onSendMessage={vi.fn()}
          onTranscribeVoiceInput={onTranscribeVoiceInput}
          canSendMessage={true}
          currentUser={null}
        />,
      );

      const voiceButton = screen.getByTitle('workspace.aiInterviewVoiceInput');
      await user.click(voiceButton);
      await user.click(voiceButton);

      await waitFor(() => {
        expect(onTranscribeVoiceInput).toHaveBeenCalledTimes(1);
      });
      expect(screen.getByText('workspace.aiInterviewVoiceTranscribing')).toBeInTheDocument();
    } finally {
      restoreMediaRecorder();
      restoreMediaDevices();
    }
  });

  it('GIVEN microphone permission denied WHEN user starts voice capture THEN permission error is shown', async () => {
    const user = userEvent.setup();
    const restoreMediaRecorder = installMediaRecorderMock();
    const restoreMediaDevices = installMediaDevicesMock({
      error: new DOMException('Permission denied', 'NotAllowedError'),
    });

    try {
      render(
        <RoomAiInterviewPanel
          messages={[]}
          isLoading={false}
          error={null}
          onSendMessage={vi.fn()}
          onTranscribeVoiceInput={vi.fn()}
          canSendMessage={true}
          currentUser={null}
        />,
      );

      await user.click(screen.getByTitle('workspace.aiInterviewVoiceInput'));
      expect(screen.getByText('workspace.aiInterviewVoicePermissionDenied')).toBeInTheDocument();
    } finally {
      restoreMediaRecorder();
      restoreMediaDevices();
    }
  });

  it('GIVEN no transcription callback WHEN rendered THEN voice button is disabled', () => {
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

    expect(screen.getByTitle('workspace.aiInterviewVoiceUnsupported')).toBeDisabled();
  });
});

function installMediaRecorderMock(): () => void {
  const originalMediaRecorder = (globalThis as { MediaRecorder?: typeof MediaRecorder })
    .MediaRecorder;

  class MockMediaRecorder {
    static isTypeSupported() {
      return true;
    }

    state: 'inactive' | 'recording' = 'inactive';
    mimeType: string;
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onerror: (() => void) | null = null;
    onstop: (() => void) | null = null;

    constructor(_stream: MediaStream, options?: { mimeType?: string }) {
      this.mimeType = options?.mimeType ?? 'audio/webm';
    }

    start() {
      this.state = 'recording';
    }

    requestData() {
      if (this.state !== 'recording') {
        return;
      }
      this.ondataavailable?.({ data: new Blob(['voice-bytes']) });
    }

    stop() {
      if (this.state !== 'recording') {
        return;
      }
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['voice-bytes']) });
      this.onstop?.();
    }
  }

  (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder =
    MockMediaRecorder as unknown as typeof MediaRecorder;

  return () => {
    if (originalMediaRecorder) {
      (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder =
        originalMediaRecorder;
      return;
    }

    delete (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  };
}

function installMediaDevicesMock(options?: { error?: Error }): () => void {
  const originalMediaDevices = navigator.mediaDevices;
  const stop = vi.fn();

  const getUserMedia = options?.error
    ? vi.fn().mockRejectedValue(options.error)
    : vi.fn().mockResolvedValue({
        getTracks: () => [{ stop }],
      });

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });

  return () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
  };
}
