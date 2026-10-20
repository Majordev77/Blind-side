// Inlines the built JS and CSS of dist-standalone/standalone.html into one
// file and writes it to ../docs/pitch/blind-side-standalone.html.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist-standalone')
const out = resolve(root, '../docs/pitch/blind-side-standalone.html')

let html = readFileSync(resolve(dist, 'standalone.html'), 'utf8')
const read = (p) => readFileSync(resolve(dist, p.replace(/^\.?\//, '')), 'utf8')

// Stylesheets -> <style>
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) =>
  `<style>\n${read(href)}\n</style>`)

// Module scripts -> inline module, moved to the end of <body> so #root exists.
const scripts = []
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  scripts.push(read(src).replace(/<\/script/gi, '<\/script'))
  return ''
})
html = html.replace('</body>', () =>
  scripts.map((js) => `<script type="module">\n${js}\n</script>\n`).join('') + '</body>')

const leftovers = html.match(/(src|href)="(\.\/|\/)[^"]*"/g)
if (leftovers) {
  console.error('Unexpected external references:', leftovers)
  process.exit(1)
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, html)
console.log(`Wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} kB)`)
