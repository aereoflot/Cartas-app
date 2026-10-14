import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Testing Library registers its own auto-cleanup through a global afterEach, which
// does not exist with `globals: false`. Without this, every render piles up in the
// same document and queries start finding two of everything.
afterEach(cleanup)
