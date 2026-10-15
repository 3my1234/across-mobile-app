# Account and catalogue presentation

Account and Settings follow the supplied light/dark mint and emerald references.
Account has identity/settings, provider workspace, live XP amount/progress/rules,
withdrawal and history/support rows. Settings keeps profile edit, appearance radio
tiles, notification sound switch, phone settings, reciprocal read receipts, local
cache clear and sign out. Existing balances, eligibility, claim and withdrawal
behavior are retained. Display headings/XP deliberately bypass compact body-text
scaling; phone accessibility scaling still applies.

Home/service cards omit provider banners, retain provider avatar/name/badge, and
show up to four title lines and three description lines with small readable text.
Details retain provider banners and full copy. Arbitrarily long descriptions cannot
both show 80% and keep compact browsing cards; full text remains one tap away.

Product recommendations are category-related without unrelated fill. Service
details now offer up to eight same-category/type services, with explicit loading,
retry and empty states. Opening a recommendation resets detail scroll. Responses
from a previous selection cannot replace the current results. Deploy updated API
before this mobile build, because older API versions ignore service category filters.

Validation: mobile regression scripts, live XP rendering in both themes, Settings
native-text checks, TypeScript, local Android/iOS exports. User still runs EAS and
checks actual phones (font scaling, small screens, native keyboard and scrolling).
