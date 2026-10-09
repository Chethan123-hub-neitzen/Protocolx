/**
 * Sample WhatsApp Chat Export
 * Realistic export containing multiline messages, @mentions, decisions,
 * deadlines, action items, and system noise.
 */

(function (window) {
  'use strict';

  const SAMPLE_CHAT_TEXT = `12/03/24, 09:15 - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
12/03/24, 09:16 - Sarah (Product): Good morning team! 👋 Today is release readiness day for the v2.4 mobile update.
12/03/24, 09:17 - Sarah (Product): We need to finalize the deployment window. Are we still on track for the Friday 5:00 PM release?
12/03/24, 09:19 - Alex (Tech Lead): Morning Sarah. Mostly yes, but we hit a snag with the new Stripe checkout webhook in staging last night.
12/03/24, 09:20 - Priya (Frontend): <Media omitted>
12/03/24, 09:21 - Priya (Frontend): That's the error screenshot from the payment screen. It's throwing a 422 Unprocessable Entity when users apply coupon codes.
12/03/24, 09:22 - David (DevOps): I checked the server logs. Redis cache is holding onto stale promotion rules from last week's flash sale.
12/03/24, 09:24 - Alex (Tech Lead): Okay, DECISION: We will NOT delay the release for this. We'll roll back the legacy webhook router and switch directly to Stripe API v3.
12/03/24, 09:25 - Alex (Tech Lead): Here is the exact fix plan:
1. Purge Redis cache namespace for discounts
2. Update the payload parser in checkout service
3. Run integration smoke tests
12/03/24, 09:28 - Sarah (Product): Perfect. If that works, we keep Friday 5:00 PM for the store rollout. Marketing is scheduled to announce on Monday at 9:00 AM sharp.
12/03/24, 09:30 - Alex (Tech Lead): @David can you flush the staging Redis cluster and bump memory allocation to 4GB before 2:00 PM today?
12/03/24, 09:31 - David (DevOps): On it @Alex. Will get that done by 1:30 PM and update the group.
12/03/24, 09:33 - Alex (Tech Lead): @Priya please update the checkout button UI to show the new loading spinner and fix the coupon error toast. Need that PR submitted by 3:00 PM.
12/03/24, 09:34 - Priya (Frontend): Got it! I am already halfway through the spinner component. PR will be ready for review by 2:45 PM.
12/03/24, 09:36 - Elena (QA): image omitted
12/03/24, 09:37 - Elena (QA): Also spotted a minor issue on iOS 17 keyboard overlapping the checkout summary. Not a blocker though, can be hotfixed in v2.4.1.
12/03/24, 09:40 - Alex (Tech Lead): Agreed Elena, defer the keyboard overlap to v2.4.1.
12/03/24, 09:42 - Sarah (Product): @Elena please start the complete regression pass on staging build #412 as soon as Priya's PR merges, ideally by 4:00 PM.
12/03/24, 09:45 - Elena (QA): Sounds good Sarah. I'll need about 2 hours to clear all payment pathways. Target sign-off is 6:00 PM today.
12/03/24, 09:48 - Alex (Tech Lead): Great momentum everyone. Summary of hard deadlines today:
- David: Redis cluster refresh by 1:30 PM
- Priya: Checkout PR by 2:45 PM
- Alex: Code review & staging merge by 3:30 PM
- Elena: Final QA sign-off by 6:00 PM
12/03/24, 09:50 - Sarah (Product): Thanks all! Let's regroup here at 5:30 PM for the final go/no-go poll. 🚀`;

  window.SampleWhatsAppChat = {
    text: SAMPLE_CHAT_TEXT,
    title: "Q2 Mobile Release Standup (12 Dec)"
  };
})(window);
