import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { BuzzflowWhatsappProvider } from './buzzflow.provider';
import { toWhatsappNumber } from './whatsapp.provider';

const SEND_URL =
  'https://api.buzzflow.co.in/API_V2/Whatsapp/send_session/SUPERSECRETTOKEN';

function providerWith(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'whatsapp.enabled': true,
    'whatsapp.buzzflowSendUrl': SEND_URL,
    'whatsapp.buzzflowTimeoutMs': 10_000,
    ...overrides,
  };
  const config = {
    get: <T>(key: string, fallback?: T) =>
      (values[key] ?? fallback) as T,
  } as ConfigService;
  return new BuzzflowWhatsappProvider(config);
}

describe('toWhatsappNumber', () => {
  it('keeps a number that already carries a country code', () => {
    expect(toWhatsappNumber('919760051792')).toBe('919760051792');
  });

  it('adds the country code to a bare ten-digit number', () => {
    expect(toWhatsappNumber('9760051792')).toBe('919760051792');
  });

  it('strips punctuation and spacing a human would type', () => {
    expect(toWhatsappNumber('+91 97600-51792')).toBe('919760051792');
  });

  // A legacy trunk zero is a domestic-dialling artefact. Left in place it
  // makes an eleven-digit number that no transport will deliver to.
  it('drops a leading trunk zero', () => {
    expect(toWhatsappNumber('09760051792')).toBe('919760051792');
  });
});

describe('BuzzflowWhatsappProvider', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
  });

  it('posts the payload shape the vendor documents', async () => {
    fetchMock.mockResolvedValue(ok({ status: true, message_id: 'wamid.1' }));

    const result = await providerWith().sendText('+91 97600 51792', 'hello');

    expect(result).toEqual({ success: true, messageId: 'wamid.1' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SEND_URL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      type: 'text',
      message: 'hello',
      // `sender_phone` is the RECIPIENT — the sending account is identified by
      // the token in the URL. If this ever changes, the login flow breaks.
      sender_phone: '919760051792',
    });
  });

  it('reports failure on a non-2xx', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('unauthorized'),
    });
    expect(await providerWith().sendText('9760051792', 'hi')).toEqual({
      success: false,
    });
  });

  // Panels routinely answer 200 with a failure in the body, so the status
  // line alone must not be trusted.
  it('reports failure when a 200 carries a rejection', async () => {
    fetchMock.mockResolvedValue(ok({ status: false, message: 'invalid number' }));
    expect(await providerWith().sendText('9760051792', 'hi')).toEqual({
      success: false,
    });
  });

  /**
   * Verbatim from a real failed send. BuzzFlow proxies Meta's Graph API and
   * returns HTTP 200 with the Graph error inside, so every one of these
   * signals has to be read as failure — an earlier version accepted it
   * because "400" was not the literal word "failed", and a parent was told
   * their code had been sent when nothing left the building.
   */
  describe('the real failure body BuzzFlow returns', () => {
    const graphFailure = {
      status: '400',
      statusText: 'failed',
      detail: {
        message:
          "Unsupported post request. Object with ID '123456789012345' does not exist, cannot be loaded due to missing permissions, or does not support this operation.",
        code: 100,
        error_subcode: 33,
        type: 'GraphMethodException',
      },
      endpoint: 'messages',
    };

    it('is treated as a failed send', async () => {
      fetchMock.mockResolvedValue(ok(graphFailure));
      expect(await providerWith().sendText('9760051792', 'hi')).toEqual({
        success: false,
      });
    });

    it.each([
      ['numeric status string', { status: '400' }],
      ['statusText', { statusText: 'failed' }],
      ['a Graph error object', { detail: { code: 100 } }],
      ['a generic error field', { error: 'nope' }],
    ])('fails on %s alone', async (_label, body) => {
      fetchMock.mockResolvedValue(ok(body));
      expect((await providerWith().sendText('9760051792', 'hi')).success).toBe(
        false,
      );
    });

    it.each([
      ['a 2xx status string', { status: '200' }],
      ['statusText success', { statusText: 'success' }],
      ['boolean status', { status: true }],
    ])('still accepts %s', async (_label, body) => {
      fetchMock.mockResolvedValue(ok(body));
      expect((await providerWith().sendText('9760051792', 'hi')).success).toBe(
        true,
      );
    });
  });

  it('accepts a 200 whose body it cannot parse', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('Sent!'),
    });
    expect((await providerWith().sendText('9760051792', 'hi')).success).toBe(
      true,
    );
  });

  it('reports failure rather than throwing when the vendor is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error(`connect ETIMEDOUT ${SEND_URL}`));
    expect(await providerWith().sendText('9760051792', 'hi')).toEqual({
      success: false,
    });
  });

  it('skips without calling out when WhatsApp is switched off', async () => {
    const result = await providerWith({ 'whatsapp.enabled': false }).sendText(
      '9760051792',
      'hi',
    );
    expect(result).toEqual({ success: true, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails loudly rather than silently when the URL is unset', async () => {
    const result = await providerWith({
      'whatsapp.buzzflowSendUrl': '',
    }).sendText('9760051792', 'hi');
    expect(result).toEqual({ success: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The token lives in the URL path, so anything logged has to be scrubbed —
  // otherwise one failed send writes the credential into the log file.
  describe('never writes the token to a log', () => {
    it('redacts it from an HTTP error', async () => {
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('boom'),
      });

      await providerWith().sendText('9760051792', 'hi');

      const logged = error.mock.calls.flat().join(' ');
      expect(logged).not.toContain('SUPERSECRETTOKEN');
      expect(logged).toContain('send_session/<token>');
    });

    it('redacts it from a thrown network error', async () => {
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      fetchMock.mockRejectedValue(new Error(`ETIMEDOUT ${SEND_URL}`));

      await providerWith().sendText('9760051792', 'hi');

      expect(error.mock.calls.flat().join(' ')).not.toContain(
        'SUPERSECRETTOKEN',
      );
    });

    // A vendor that echoes the message back would otherwise put the code in
    // the log — while Meta's 15-16 digit object ids must survive, since they
    // are what makes a failure diagnosable.
    it('masks an echoed login code but keeps vendor object ids', async () => {
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      fetchMock.mockResolvedValue(
        ok({
          status: '400',
          statusText: 'failed',
          detail: {
            message:
              "Object with ID '1274131082445260' does not exist. Sent: 482913 is your code",
            code: 100,
          },
        }),
      );

      await providerWith().sendText('9760051792', '482913 is your code');

      const logged = error.mock.calls.flat().join(' ');
      expect(logged).not.toContain('482913');
      expect(logged).toContain('1274131082445260');
    });

    it('never writes the message body, which may be a login code', async () => {
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('boom'),
      });

      await providerWith().sendText('9760051792', '482913 is your code');

      expect(error.mock.calls.flat().join(' ')).not.toContain('482913');
    });
  });
});
