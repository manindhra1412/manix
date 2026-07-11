import { build, context } from 'esbuild'
import { rmSync } from 'node:fs'
import fg from 'fast-glob'

const watch = process.argv.includes('--watch')

rmSync('dist', { recursive: true, force: true })

const options = {
  entryPoints: await fg('src/**/*.js'),
  outdir: 'dist',
  outbase: 'src',
  bundle: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  loader: { '.js': 'jsx' },
  jsx: 'automatic',
  logLevel: 'info',
}

if (watch) {
  const ctx = await context(options)
  await ctx.watch()
  console.log('watching src/ …')
} else {
  await build(options)
}
