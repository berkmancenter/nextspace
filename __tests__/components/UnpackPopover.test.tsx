import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { UnpackPopover } from '../../components/UnpackPopover';
import { SendData } from '../../utils';
import { TranscriptChunkText, UnpackSelection } from '../../types.internal';
import { ConversationTypeProvider } from '../../context/ConversationTypeContext';

jest.mock('../../utils', () => ({
  SendData: jest.fn(),
  Api: { get: jest.fn(() => ({ getAccessToken: jest.fn(() => 'token') })) },
}));

const mockSendData = SendData as jest.Mock;

const chunks: TranscriptChunkText[] = [
  {
    id: 'c1',
    text: "The citation graph isn't scale-free. Precedential weight concentrates in a few circuits, then decays.",
  },
];
const text = chunks[0].text;
const selection: UnpackSelection = {
  startMessageId: 'c1',
  startOffset: text.indexOf('weight'),
  endMessageId: 'c1',
  endOffset: text.indexOf('few'),
};
const widenedRange = {
  startMessageId: 'c1',
  startOffset: text.indexOf('Precedential'),
  endMessageId: 'c1',
  endOffset: text.length,
};

const preview = {
  askId: 'ask-1',
  explanation: {
    range: widenedRange,
    chunkIds: ['c1'],
    passage: { start: '2025-10-17T10:43:00Z', end: '2025-10-17T10:43:10Z' },
    quote: 'Precedential weight concentrates in a few circuits, then decays (server copy).',
    whatTheyreSaying:
      "A ruling's influence mostly comes from a few appeals courts. It fades at a steady rate. The speaker calls that rate doctrinal half-life.",
    whyItMatters: 'Lower courts lean on fewer precedents.',
    terms: [
      { term: 'Half-life', text: 'The time it takes something to drop by half.' },
      { term: 'Circuits', text: 'The federal courts of appeals.' },
    ],
    headline: 'Doctrinal half-life',
    visual: null,
  },
};

const respond = ({
  previewResponse = preview as unknown,
  sendResponse = { askId: 'ask-1', status: 'sent' } as unknown,
} = {}) =>
  mockSendData.mockImplementation((url: string) =>
    Promise.resolve(url.endsWith('/preview') ? previewResponse : sendResponse),
  );

const neverAnswerPreview = (sendResponse: unknown = { askId: 'ask-1', status: 'sent' }) =>
  mockSendData.mockImplementation((url: string) =>
    url.endsWith('/preview') ? new Promise(() => {}) : Promise.resolve(sendResponse),
  );

const passcode = 'transcript-passcode';

// MUI's ClickAwayListener starts listening a tick after it mounts.
const clickAwayReady = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

const previewCalls = () => mockSendData.mock.calls.filter(([url]) => url.endsWith('/preview'));
const sendCalls = () => mockSendData.mock.calls.filter(([url]) => url.endsWith('/send'));

function renderPopover(props: Partial<React.ComponentProps<typeof UnpackPopover>> = {}) {
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  const handlers = { onClose: jest.fn(), onOpenPrivateChat: jest.fn() };
  const utils = render(
    <div>
      <button type="button">Outside</button>
      <UnpackPopover
        conversationId="conv-1"
        transcriptPasscode={passcode}
        target={{ selection, anchor }}
        chunks={chunks}
        {...handlers}
        {...props}
      />
    </div>,
  );
  return { ...utils, ...handlers };
}

describe('UnpackPopover', () => {
  beforeEach(() => mockSendData.mockReset());

  it('shows the passage widened to whole sentences right away, while Berkie reads it', () => {
    neverAnswerPreview();
    renderPopover();

    expect(screen.getByRole('dialog', { name: 'Unpack this with Berkie' })).toBeInTheDocument();
    expect(screen.getByText('What the speaker said')).toBeInTheDocument();
    expect(screen.getByText('"Precedential weight concentrates in a few circuits, then decays."')).toBeInTheDocument();
    expect(screen.getByText('Berkie is reading this')).toBeInTheDocument();
    expect(screen.getByText('Every ask is anonymous, including to organizers.')).toBeInTheDocument();
  });

  it('shows bouncing dots after the reading line that screen readers skip while Berkie reads the passage', () => {
    neverAnswerPreview();
    renderPopover();

    const dots = screen.getByTestId('unpack-loading-dots');
    expect(dots).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Berkie is reading this').compareDocumentPosition(dots)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('removes the bouncing dots once the preview arrives', async () => {
    respond();
    renderPopover();

    await screen.findByText('The full explanation also covers why it matters and 2 key terms.');
    expect(screen.queryByTestId('unpack-loading-dots')).not.toBeInTheDocument();
  });

  it('asks for a preview of the widened passage', async () => {
    respond();
    renderPopover();

    await waitFor(() => expect(previewCalls()).toHaveLength(1));
    expect(previewCalls()[0][0]).toBe('unpack/conv-1/preview');
    expect(JSON.parse(previewCalls()[0][3].body)).toEqual({ ...widenedRange, transcriptPasscode: passcode });
  });

  it("shows the opening of Berkie's explanation and what the full one also covers", async () => {
    respond();
    renderPopover();

    expect(
      await screen.findByText("A ruling's influence mostly comes from a few appeals courts. It fades at a steady rate.…"),
    ).toBeInTheDocument();
    expect(screen.getByText('The full explanation also covers why it matters and 2 key terms.')).toBeInTheDocument();
    expect(screen.queryByText('Berkie is reading this')).not.toBeInTheDocument();
  });

  it("switches to the server's copy of the quote once the preview arrives", async () => {
    respond();
    renderPopover();

    expect(
      await screen.findByText('"Precedential weight concentrates in a few circuits, then decays (server copy)."'),
    ).toBeInTheDocument();
  });

  it('sends to Private Chat before the preview arrives', async () => {
    neverAnswerPreview();
    const user = userEvent.setup();
    const { onOpenPrivateChat } = renderPopover();

    await user.click(screen.getByRole('button', { name: 'Send to my Private Chat' }));

    expect(sendCalls()).toEqual([
      ['unpack/conv-1/send', { ...widenedRange, transcriptPasscode: passcode, destination: 'privateChat' }, 'token'],
    ]);
    expect(await screen.findByText('Your explanation is in your Private Chat.')).toBeInTheDocument();
  });

  it('moves focus to Open Private Chat once the explanation is sent', async () => {
    neverAnswerPreview();
    const user = userEvent.setup();
    renderPopover({ focusOnOpen: true });

    await user.click(screen.getByRole('button', { name: 'Send to my Private Chat' }));

    expect(await screen.findByRole('button', { name: 'Open Private Chat' })).toHaveFocus();
  });

  it('moves focus to the confirmation when Private Chat is already on screen', async () => {
    neverAnswerPreview();
    const user = userEvent.setup();
    renderPopover({ onOpenPrivateChat: undefined });

    await user.click(screen.getByRole('button', { name: 'Send to my Private Chat' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
  });

  it('keeps the confirmation area on the page before sending, so screen readers announce it', () => {
    neverAnswerPreview();
    renderPopover();

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('opens Private Chat and closes the popover', async () => {
    neverAnswerPreview();
    const user = userEvent.setup();
    const { onOpenPrivateChat, onClose } = renderPopover();
    await user.click(screen.getByRole('button', { name: 'Send to my Private Chat' }));

    await user.click(await screen.findByRole('button', { name: 'Open Private Chat' }));

    expect(onOpenPrivateChat).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith('openPrivateChat');
  });

  it('sends only once when Send is clicked twice', async () => {
    let finishSending: (value: unknown) => void = () => {};
    mockSendData.mockImplementation((url: string) =>
      url.endsWith('/preview') ? new Promise(() => {}) : new Promise((resolve) => (finishSending = resolve)),
    );
    const user = userEvent.setup();
    renderPopover();
    const send = screen.getByRole('button', { name: 'Send to my Private Chat' });

    await user.click(send);
    expect(send).toHaveAttribute('aria-disabled', 'true');
    expect(send).toHaveFocus();
    await user.click(send);
    finishSending({ askId: 'ask-1', status: 'sent' });

    expect(await screen.findByText('Your explanation is in your Private Chat.')).toBeInTheDocument();
    expect(sendCalls()).toHaveLength(1);
  });

  it('says the card is on its way when Berkie is still writing it', async () => {
    neverAnswerPreview({ askId: 'ask-1', status: 'pending' });
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole('button', { name: 'Send to my Private Chat' }));

    expect(
      await screen.findByText('Berkie is finishing your explanation. It will appear in your Private Chat.'),
    ).toBeInTheDocument();
  });

  it('leaves out the Open Private Chat button when Private Chat is already on screen', async () => {
    neverAnswerPreview();
    const user = userEvent.setup();
    renderPopover({ onOpenPrivateChat: undefined });

    await user.click(screen.getByRole('button', { name: 'Send to my Private Chat' }));

    expect(await screen.findByText('Your explanation is in your Private Chat.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Private Chat' })).not.toBeInTheDocument();
  });

  it('asks for a shorter passage instead of a preview when the selection is too long', async () => {
    respond();
    const longText = `${'word '.repeat(450).trim()}.`;
    renderPopover({
      chunks: [{ id: 'long', text: longText }],
      target: {
        selection: { startMessageId: 'long', startOffset: 0, endMessageId: 'long', endOffset: 20 },
        anchor: document.body,
      },
    });

    expect(screen.getByText('Select a shorter passage.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to my Private Chat' })).toHaveAttribute('aria-disabled', 'true');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(previewCalls()).toHaveLength(0);
  });

  it('offers to try again when Berkie could not write the explanation', async () => {
    mockSendData.mockResolvedValueOnce({ error: true, status: 503, reason: 'unpackFailed' });
    mockSendData.mockResolvedValueOnce(preview);
    const user = userEvent.setup();
    renderPopover();

    expect(await screen.findByText("Berkie couldn't unpack this just now.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to my Private Chat' })).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('The full explanation also covers why it matters and 2 key terms.')).toBeInTheDocument();
  });

  it('keeps focus in the popover after Try again', async () => {
    mockSendData.mockResolvedValueOnce({ error: true, status: 503, reason: 'unpackFailed' });
    mockSendData.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPopover();

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('explains a refused send and blocks sending again when it cannot work', async () => {
    neverAnswerPreview({ error: true, status: 409, reason: 'noPrivateChat' });
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole('button', { name: 'Send to my Private Chat' }));

    expect(
      await screen.findByText("Berkie couldn't find your Private Chat. Reload the page, then try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to my Private Chat' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('lets the participant send again after a rate limit', async () => {
    neverAnswerPreview({ error: true, status: 429, reason: 'rateLimited' });
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole('button', { name: 'Send to my Private Chat' }));
    await screen.findByText("You've asked about a lot of passages this minute. Wait a moment, then try again.");
    await user.click(screen.getByRole('button', { name: 'Send to my Private Chat' }));

    expect(sendCalls()).toHaveLength(2);
  });

  it('closes with Escape, with the close button, and with a click outside', async () => {
    neverAnswerPreview();
    const user = userEvent.setup();
    const { onClose } = renderPopover();

    fireEvent.keyDown(document, { key: 'Escape' });
    await user.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('ignores Escape pressed somewhere else on the page', () => {
    neverAnswerPreview();
    const { onClose } = renderPopover();
    const outside = screen.getByRole('button', { name: 'Outside' });
    outside.focus();

    fireEvent.keyDown(outside, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the Escape that closes it from also reaching the rest of the page', () => {
    neverAnswerPreview();
    const { onClose } = renderPopover();
    const pageEscape = jest.fn();
    window.addEventListener('keydown', pageEscape);

    fireEvent.keyDown(document, { key: 'Escape' });
    window.removeEventListener('keydown', pageEscape);

    expect(onClose).toHaveBeenCalledWith('escape');
    expect(pageEscape).not.toHaveBeenCalled();
  });

  it('stays open for a right-click outside', async () => {
    neverAnswerPreview();
    const { onClose } = renderPopover();
    await clickAwayReady();
    const outside = screen.getByRole('button', { name: 'Outside' });

    fireEvent.mouseDown(outside, { button: 2 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(outside);

    expect(onClose).toHaveBeenCalledWith('clickAway');
  });

  it('stays open while the participant drags a scroll bar outside it', async () => {
    neverAnswerPreview();
    const { onClose } = renderPopover();
    await clickAwayReady();
    const transcript = document.createElement('div');
    Object.defineProperties(transcript, {
      clientWidth: { value: 300 },
      clientHeight: { value: 200 },
      scrollHeight: { value: 1000 },
    });
    transcript.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 315, bottom: 200, width: 315, height: 200 }) as DOMRect;
    document.body.appendChild(transcript);
    // MUI reads any press past the page's width, which jsdom reports as 0, as a press on the page's scroll bar.
    const page = { clientWidth: { value: 1024, configurable: true }, clientHeight: { value: 768, configurable: true } };
    Object.defineProperties(document.documentElement, page);

    fireEvent.mouseDown(transcript, { clientX: 305, clientY: 50 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(transcript, { clientX: 50, clientY: 50 });
    Object.keys(page).forEach(
      (property) => delete (document.documentElement as unknown as Record<string, unknown>)[property],
    );

    expect(onClose).toHaveBeenCalledWith('clickAway');
  });

  it('closes when Tab moves past the last control, instead of jumping to the end of the page', async () => {
    neverAnswerPreview();
    const user = userEvent.setup();
    const { onClose } = renderPopover({ focusOnOpen: true });
    screen.getByRole('button', { name: 'Send to my Private Chat' }).focus();

    await user.tab();

    expect(onClose).toHaveBeenCalledWith('tabOut');
  });

  it('closes when Tab leaves the confirmation after sending, with Private Chat already on screen', async () => {
    neverAnswerPreview();
    const user = userEvent.setup();
    const { onClose } = renderPopover({ onOpenPrivateChat: undefined });
    await user.click(screen.getByRole('button', { name: 'Send to my Private Chat' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());

    await user.tab();

    expect(onClose).toHaveBeenCalledWith('tabOut');
  });

  it('closes when Shift+Tab moves back out of the popover', async () => {
    neverAnswerPreview();
    const user = userEvent.setup();
    const { onClose } = renderPopover({ focusOnOpen: true });

    await user.tab({ shift: true });

    expect(onClose).toHaveBeenCalledWith('tabOut');
  });

  it("names the event's assistant", () => {
    neverAnswerPreview();
    render(
      <ConversationTypeProvider initialBotName="Juniper">
        <UnpackPopover
          conversationId="conv-1"
          target={{ selection, anchor: document.body }}
          chunks={chunks}
          onClose={jest.fn()}
        />
      </ConversationTypeProvider>,
    );

    expect(screen.getByRole('dialog', { name: 'Unpack this with Juniper' })).toBeInTheDocument();
    expect(screen.getByText('Juniper is reading this')).toBeInTheDocument();
  });

  it('moves focus into the popover when it was opened from the keyboard', () => {
    neverAnswerPreview();
    renderPopover({ focusOnOpen: true });

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('leaves focus alone when it was opened by selecting text', () => {
    neverAnswerPreview();
    renderPopover();

    expect(screen.getByRole('dialog')).not.toHaveFocus();
  });

  it('has no accessibility violations while loading or once the preview arrives', async () => {
    respond();
    const { container } = renderPopover();
    expect(await axe(container.ownerDocument.body)).toHaveNoViolations();

    await screen.findByText('The full explanation also covers why it matters and 2 key terms.');
    expect(await axe(container.ownerDocument.body)).toHaveNoViolations();
  });
});
