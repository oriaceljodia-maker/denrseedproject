# DENR Seed Inventory - Bug Fix Tasks

## High
- [x] 1. Wire up `NavbarComponent` in router.js (render + bindEvents)

## Medium
- [x] 2. Add missing badge CSS classes: .badge-disbursed and .badge-cancelled
- [x] 3. Add escaping utility and use in all template interpolations (XSS / HTML-breakage)

## Minor
- [x] 4. Guard null `currentUser` in my-requests.page.js
- [x] 5. Remove redundant double-navigation on login

## Verify
- [x] 6. Run build to confirm no errors (vite build passes)
