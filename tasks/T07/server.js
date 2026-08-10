import { createServer } from 'node:http'
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./dist/', import.meta.url))
const dataDir = fileURLToPath(new URL('./data/sessions/', import.meta.url))
const port = Number(process.env.PORT || 4177)

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
}

async function saveResult(req, res) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks).toString('utf8')
  const parsed = JSON.parse(body)
  await mkdir(dataDir, { recursive: true })
  const id = String(parsed.task_id || 'T07').replace(/[^a-zA-Z0-9_-]/g, '')
  const filename = `${id}_${Date.now()}.json`
  await writeFile(join(dataDir, filename), JSON.stringify(parsed, null, 2), 'utf8')
  res.writeHead(201, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ saved: true, filename }))
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/results') return await saveResult(req, res)
    const pathname = decodeURIComponent((req.url || '/').split('?')[0])
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const target = normalize(join(root, relative))
    if (!target.startsWith(normalize(root))) throw new Error('invalid path')
    const info = await stat(target)
    const file = info.isDirectory() ? join(target, 'index.html') : target
    const content = await readFile(file)
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(content)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`T07 assessment tool: http://127.0.0.1:${port}`)
})
