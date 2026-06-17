import type { Dispatch, SetStateAction } from 'react';

export type IntentPayload = {
  intent?: any;
  action?: any;
  text?: any;
  message?: any;
  command?: any;
  [k: string]: any;
};

export type VoiceDeps = {
  billId?: string | undefined;
  handleStartBilling: () => Promise<void> | void;
  setShowUnifiedControlsModal: (v: boolean) => void;
  setUnifiedModalTab: (
    t: 'payment' | 'inventory' | 'refund' | 'rewards'
  ) => void;
  setNotificationMessage: (m: string) => void;
  setNotificationType: (
    t: 'success' | 'danger' | 'warning' | 'info'
  ) => void;
  setShowNotification: (b: boolean) => void;
  t?: (k: string, opts?: any) => string;
};

// Build candidate string from payload
function buildCandidateString(payload: IntentPayload) {
  const parts: string[] = [];

  try {
    if (payload?.intent) {
      parts.push(String(payload.intent));
    }

    if (
      typeof payload?.intent === 'object' &&
      payload.intent?.name
    ) {
      parts.push(String(payload.intent.name));
    }
  } catch {}

  try {
    if (payload?.action) {
      parts.push(String(payload.action));
    }
  } catch {}

  try {
    if (payload?.text) {
      parts.push(String(payload.text));
    }
  } catch {}

  try {
    if (payload?.message) {
      parts.push(String(payload.message));
    }
  } catch {}

  try {
    if (payload?.command) {
      parts.push(String(payload.command));
    }
  } catch {}

  return parts.join(' ').toLowerCase();
}

// Collect all values recursively
function collectStringValues(
  obj: any,
  out: string[] = []
): string[] {
  if (obj == null) {
    return out;
  }

  if (typeof obj === 'string') {
    out.push(obj);
    return out;
  }

  if (
    typeof obj === 'number' ||
    typeof obj === 'boolean'
  ) {
    out.push(String(obj));
    return out;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectStringValues(item, out);
    }

    return out;
  }

  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      try {
        collectStringValues(obj[key], out);
      } catch {
        // ignore
      }
    }
  }

  return out;
}

export function handleVoiceIntent(
  payload: IntentPayload,
  deps: VoiceDeps
) {
  try {
    console.log(
      'voiceIntentHandler received payload:',
      payload
    );

    const act = String(
      payload?.intent || payload?.action || ''
    )
      .trim()
      .toLowerCase();

    const txt = String(
      payload?.text ||
        payload?.message ||
        payload?.command ||
        ''
    )
      .trim()
      .toLowerCase();

    const candStr = buildCandidateString(payload);

    const flatValues = collectStringValues(payload)
      .map(String)
      .join(' ')
      .toLowerCase();

    const payloadJson = (() => {
      try {
        return JSON.stringify(payload).toLowerCase();
      } catch {
        return '';
      }
    })();

    console.log('ACT:', act);
    console.log('TXT:', txt);
    console.log('CANDIDATE:', candStr);

    // ==================================================
    // START BILL
    // ==================================================
    if (
      act === 'start_bill' ||
      act === 'startbilling' ||
      act === 'createbill' ||
      act === 'create_bill' ||
      /start\s*(a\s*)?bill/i.test(txt) ||
      /start billing/i.test(txt) ||
      /naya bill/i.test(txt)
    ) {
      console.log('START BILL MATCHED');

      if (!deps.billId) {
        void deps.handleStartBilling();
      } else {
        const msg = deps.t
          ? deps.t('billing.alreadyStarted')
          : 'Bill already started';

        deps.setNotificationMessage(msg);
        deps.setNotificationType('info');
        deps.setShowNotification(true);

        setTimeout(() => {
          deps.setShowNotification(false);
        }, 3000);
      }

      return;
    }

    // ==================================================
    // CLOSE BILLING CONTROL
    // CHECK BEFORE OPEN
    // ==================================================
    if (
      act === 'close_billing_control' ||
      act === 'close_billing_controls' ) {
      console.log('CLOSE BILLING CONTROL MATCHED');

      deps.setShowUnifiedControlsModal(false);

      deps.setNotificationMessage(
        'Billing controls closed'
      );
      deps.setNotificationType('success');
      deps.setShowNotification(true);

      setTimeout(() => {
        deps.setShowNotification(false);
      }, 2000);

      return;
    }

    // ==================================================
    // OPEN BILLING CONTROL
    // ==================================================
    if (
      act === 'open_billing_control' || act === 'open_billing_controls' ) {
      console.log(
        'OPEN BILLING CONTROL MATCHED'
      );

      const tab = String(
        payload?.tab || ''
      ).toLowerCase();

      if (
        tab === 'payment' ||
        tab === 'refund' ||
        tab === 'inventory' ||
        tab === 'rewards'
      ) {
        deps.setUnifiedModalTab(tab as any);
      } else {
        deps.setUnifiedModalTab('inventory');
      }

      deps.setShowUnifiedControlsModal(true);

      return;
    }

    // ==================================================
    // FALLBACK
    // ==================================================
    if (txt || candStr) {
      const message = txt || candStr;

      deps.setNotificationMessage(
        message.length > 120
          ? `${message.slice(0, 120)}...`
          : message
      );

      deps.setNotificationType('info');
      deps.setShowNotification(true);

      setTimeout(() => {
        deps.setShowNotification(false);
      }, 4000);
    }
  } catch (e) {
    console.error(
      'voiceIntentHandler error:',
      e
    );
  }
}

export default handleVoiceIntent;