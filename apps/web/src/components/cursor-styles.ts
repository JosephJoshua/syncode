interface CursorUser {
  name?: string;
  color?: string;
  colorLight?: string;
}

export interface CursorStyleOptions {
  idleClientIds?: ReadonlySet<number>;
  transparentClientIds?: ReadonlySet<number>;
}

// Threshold at which a remote cursor fades out after no awareness updates.
export const IDLE_HIDE_MS = 8_000;
// Opacity applied when the local user hovers a remote cursor so it stops blocking the view.
export const HOVER_TRANSPARENT_OPACITY = 0.25;

export function buildCursorCssRules(
  states: Map<number, Record<string, unknown>>,
  localClientID: number,
  options: CursorStyleOptions = {},
): string[] {
  const rules: string[] = [];
  const idle = options.idleClientIds ?? new Set<number>();
  const transparent = options.transparentClientIds ?? new Set<number>();
  states.forEach((state, clientID) => {
    if (clientID === localClientID) return;
    const user = state.user as CursorUser | undefined;
    if (!user?.color || !/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(user.color))
      return;
    const light =
      user.colorLight && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(user.colorLight)
        ? user.colorLight
        : `${user.color}33`;
    const name = (user.name ?? '').replaceAll(/[\\";{}\n\r]/g, '');

    rules.push(
      `.yRemoteSelection-${clientID} {
        background-color: ${light};
        border-radius: 1px;
        transition: opacity 300ms ease-out;
      }`,
      `.yRemoteSelectionHead-${clientID} {
        position: relative;
        border-left: 2px solid ${user.color};
        transition: opacity 300ms ease-out;
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
        transition: opacity 300ms ease-out;
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
        transition: opacity 300ms ease-out;
      }`,
    );

    if (idle.has(clientID)) {
      rules.push(
        `.yRemoteSelection-${clientID},
        .yRemoteSelectionHead-${clientID},
        .yRemoteSelectionHead-${clientID}::before,
        .yRemoteSelectionHead-${clientID}::after {
          opacity: 0;
        }`,
      );
    } else if (transparent.has(clientID)) {
      rules.push(
        `.yRemoteSelection-${clientID},
        .yRemoteSelectionHead-${clientID},
        .yRemoteSelectionHead-${clientID}::before,
        .yRemoteSelectionHead-${clientID}::after {
          opacity: ${HOVER_TRANSPARENT_OPACITY};
        }`,
      );
    }
  });
  return rules;
}
