import { serve } from './cloudflare/server.mjs';
import { submissionFingerprint } from './cloudflare/checkin-submission.mjs';
export { CheckinSubmission } from './cloudflare/checkin-submission.mjs';

const checkinRoutes = new Set(['/api/checkin', '/api/checkin/pantry', '/api/checkin/both']);

export default {
  async fetch(request, env, ctx) {
    const route = new URL(request.url).pathname.toLowerCase().replace(/\/$/, '');
    if (request.method !== 'POST' || !checkinRoutes.has(route)) return serve(request, env, ctx);
    if (!env.GOOGLE_SHEETS_ID || !env.GOOGLE_SERVICE_ACCOUNT_JSON) return serve(request, env, ctx);
    if (!env.CHECKIN_SUBMISSIONS) return Response.json({ ok: false, error: 'Check-in receipts are not configured' }, { status: 503 });
    let submission;
    try {
      submission = await submissionFingerprint(request);
    } catch {
      return Response.json({ ok: false, error: 'Invalid check-in' }, { status: 400 });
    }
    const receipt = env.CHECKIN_SUBMISSIONS.get(env.CHECKIN_SUBMISSIONS.idFromName(submission.requestId));
    return receipt.fetch(request);
  },
};
