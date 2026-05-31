import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type Participant, RoomParticipantCard } from './room-participant-card.js';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

const hostParticipant: Participant = {
  userId: 'host-user',
  username: 'host',
  displayName: 'Host User',
  avatarUrl: null,
  role: 'interviewer',
  isActive: true,
  isReady: false,
};

describe('RoomParticipantCard', () => {
  it('GIVEN room host card and role manager WHEN role changes THEN emits role change without ownership transfer', async () => {
    const user = userEvent.setup();
    const onRoleChange = vi.fn();
    const onTransferOwnership = vi.fn();

    render(
      <RoomParticipantCard
        participant={hostParticipant}
        currentUserId="role-manager"
        roomHostId="host-user"
        canManageParticipants
        isUpdatingRole={false}
        isTransferringOwnership={false}
        onRoleChange={onRoleChange}
        onTransferOwnership={onTransferOwnership}
      />,
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'roleSelect.observer' }));

    expect(onRoleChange).toHaveBeenCalledWith('host-user', 'observer');
    expect(onTransferOwnership).not.toHaveBeenCalled();
  });
});
