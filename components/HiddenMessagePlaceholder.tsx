import React, { FC } from 'react';

/**
 * Stands in for a message a moderator hid when the server's display policy keeps a stub rather
 * than dropping it. Nothing sends stubs yet (the server omits), so this is the one place that
 * changes when the policy flips.
 */
export const HiddenMessagePlaceholder: FC = () => (
  <div data-testid="hidden-message-placeholder" className="rounded-lg bg-gray-100 px-3 py-2 text-sm italic text-gray-500">
    Message removed by a moderator
  </div>
);

/** True for the body-less stub a non-admin's feed holds in place of a hidden message. */
export const isHiddenStub = (message: { hidden?: boolean; body?: unknown }): boolean =>
  Boolean(message.hidden) && message.body === null;
