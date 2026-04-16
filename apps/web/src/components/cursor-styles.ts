interface CursorUser {
  name?: string;
  color?: string;
  colorLight?: string;
}

export function buildCursorCssRules(
  states: Map<number, Record<string, unknown>>,
  localClientID: number,
): string[] {
  const rules: string[] = [];
  states.forEach((state, clientID) => {
    if (clientID === localClientID) return;
    const user = state.user as CursorUser | undefined;
    if (!user?.color || !/^#[\da-f]{3,8}$/i.test(user.color)) return;
    const light =
      user.colorLight && /^#[\da-f]{3,8}$/i.test(user.colorLight)
        ? user.colorLight
        : `${user.color}33`;
    const name = (user.name ?? '').replace(/[\\";{}]/g, '');

    rules.push(
      `.yRemoteSelection-${clientID} {
        background-color: ${light};
        border-radius: 1px;
      }`,
      `.yRemoteSelectionHead-${clientID} {
        position: relative;
        border-left: 2px solid ${user.color};
      }`,
      `.yRemoteSelectionHead-${clientID}::after {
        content: "${name}";
        position: absolute;
        top: -1.4em;
        left: -2px;
        background: ${user.color};
        color: #fff;
        font-size: 9px;
        font-family: 'Geist Mono', monospace;
        font-weight: 600;
        letter-spacing: 0.02em;
        padding: 1px 5px;
        border-radius: 3px 3px 3px 0;
        line-height: 14px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 10;
        opacity: 0.9;
        box-shadow: 0 1px 3px rgba(0,0,0,0.25);
      }`,
      `.yRemoteSelectionHead-${clientID}::before {
        content: "";
        position: absolute;
        top: 0;
        left: -2px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${user.color};
        transform: translateY(-50%);
        pointer-events: none;
        z-index: 10;
      }`,
    );
  });
  return rules;
}
