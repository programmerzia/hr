# Inbox

Port one-to-one from `resources/js/mock/stores/inbox.ts` (same validation messages). Invokable classes in `Actions/`.

Actions to port:
- [ ] Notify (Laravel database notifications, data {kind,title,body,link}), MarkRead, MarkAllRead; badge counts in HandleInertiaRequests::badges
