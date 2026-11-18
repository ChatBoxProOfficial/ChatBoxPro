import fs from 'node:fs'
import path from 'node:path'

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  )

const files = walk('web/src').filter((f) => /\.(ts|tsx)$/.test(f))

const show = (label, re) => {
  console.log('\n=== ' + label + ' ===')
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n')
    lines.forEach((l, i) => {
      if (re.test(l)) console.log(`${f}:${i + 1}  ${l.trim().slice(0, 110)}`)
    })
  }
}

show('teamMode', /teamMode/)
show('models 元数据', /\/models|fetchModels|context_window/)
show('云端/storage', /云端|'cloud'/)
