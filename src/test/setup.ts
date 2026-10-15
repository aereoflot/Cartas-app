import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Testing Library registers its own auto-cleanup through a global afterEach, which
// does not exist with `globals: false`. Without this, every render piles up in the
// same document and queries start finding two of everything.
afterEach(cleanup)

// jsdom implements no layout, so it has no `scrollIntoView`. Real browsers do,
// and the decks screen calls it when you tap the search box. Without this the
// click throws, vitest reports an unhandled error and warns that the run may be
// showing false positives — a stub is cheaper than not testing the tap.
if (typeof Element !== 'undefined' && Element.prototype.scrollIntoView === undefined) {
  Element.prototype.scrollIntoView = () => undefined
}
