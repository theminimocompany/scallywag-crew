import { readFile, writeFile } from 'node:fs/promises'

const indexPath = new URL('../dist/index.html', import.meta.url)
const fallbackPath = new URL('../dist/404.html', import.meta.url)
const html = await readFile(indexPath, 'utf8')

if (!/(?:src|href)="\/assets\//.test(html)) {
  throw new Error('Expected root-relative production assets in dist/index.html.')
}
if (!html.includes('<title>Crewlist</title>')) {
  throw new Error('dist/index.html is not the expected Crewlist entry point.')
}

await writeFile(fallbackPath, html)
console.log('Created dist/404.html for clean-route direct loads.')
