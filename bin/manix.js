#!/usr/bin/env node
import('../dist/cli.js').catch((err) => {
  if (err?.code === 'ERR_MODULE_NOT_FOUND' && String(err.message).includes('dist')) {
    console.error('manix: dist/ missing — run `npm run build` first.')
  } else {
    console.error(err)
  }
  process.exit(1)
})
