import { serve } from './server.mjs';

export async function submissionFingerprint(request) {
  const route = new URL(request.url).pathname.toLowerCase().replace(/\/$/, '');
  const text = await request.clone().text();
  if (text.length > 16384) throw new Error('Check-in is too large');
  const body = JSON.parse(text);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid check-in');
  const { requestId: suppliedId, needsReview: _needsReview, ...payload } = body;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ route, body: payload })));
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const requestId = suppliedId || `legacy-${fingerprint}`;
  if (typeof requestId !== 'string' || requestId.length > 160) throw new Error('Invalid request ID');
  return { requestId, fingerprint };
}

function needsReview() {
  return Response.json({ ok: false, needsReview: true, error: 'Check this submission in the Sheet before retrying.' }, { status: 409 });
}

// One object owns each receipt. Persist the claim before contacting Google so
// an interrupted save cannot append the same submission again automatically.
export class CheckinSubmission {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.pending = Promise.resolve();
  }

  fetch(request) {
    const response = this.pending.then(() => this.save(request));
    this.pending = response.catch(() => {});
    return response;
  }

  async save(request) {
    const reconciliation = request.headers.get('x-checkin-reconcile');
    if (reconciliation && reconciliation !== 'saved') return Response.json({ ok: false, error: 'Invalid reconciliation' }, { status: 400 });
    const { fingerprint } = await submissionFingerprint(request);
    const receipt = await this.ctx.storage.get('receipt');
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) {
        return Response.json({ ok: false, needsReview: true, error: 'This request ID was used for a different check-in.' }, { status: 409 });
      }
      if (reconciliation === 'saved') {
        await this.ctx.storage.put('receipt', { ...receipt, state: 'complete', reconciledAt: Date.now() });
        return Response.json({ ok: true });
      }
      if (receipt.state === 'complete') return Response.json({ ok: true });
      return needsReview();
    }

    if (reconciliation) return needsReview();
    await this.ctx.storage.put('receipt', { fingerprint, state: 'started', createdAt: Date.now() });
    try {
      const response = await serve(request, this.env, this.ctx);
      if (response.ok) {
        await this.ctx.storage.put('receipt', { fingerprint, state: 'complete', createdAt: Date.now() });
        return response;
      }
    } catch (error) {
      console.error('Check-in save needs review:', error.name);
    }
    return needsReview();
  }
}
