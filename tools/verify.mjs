// Playwright 검증: 실제 index.html을 열어 게임과 같은 물리 코드(Core)로 AI끼리 N판을 돌리고,
// 궤적 그림과 화면 스크린샷을 남긴다.  사용법: node tools/verify.mjs [판수] [출력폴더]
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = +process.argv[2] || 300, out = process.argv[3] || path.join(root, 'verify');
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.join(root, 'index.html');
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(url);
const res = await p.evaluate(n => BeyLab.run(n, 1), N);
const traj = await p.evaluate(() => BeyLab.trajectories(9, 7));
fs.writeFileSync(path.join(out, 'trajectories.png'), Buffer.from(traj.split(',')[1], 'base64'));
fs.writeFileSync(path.join(out, 'stats.json'), JSON.stringify(res, null, 1));
const shots = [['ipad', 1180, 820], ['iphone', 844, 390]];
for (const [name, w, h] of shots) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const q = await ctx.newPage(); q.on('pageerror', e => errors.push(name + ': ' + e.message));
  await q.goto(url); await q.waitForTimeout(500);
  await q.screenshot({ path: path.join(out, `${name}-title.png`) });
  await q.click('[data-mode="multi"]'); await q.waitForTimeout(200);
  await q.screenshot({ path: path.join(out, `${name}-select.png`) });
  // 화면 확인용: 메뉴에는 없는 숨은 경로(AI끼리)로 판을 돌려 전투 장면을 찍는다
  await q.evaluate(() => { Game.S.mode = 'watch'; Game.S.picks = ['spriggan', 'fafnir']; Game.startMatch(); });
  await q.waitForTimeout(5500); await q.screenshot({ path: path.join(out, `${name}-battle.png`) });
  await q.evaluate(() => { Game.S.phase = 'menu'; Game.S.n = 2; });
  await q.reload(); await q.waitForTimeout(300);
  await q.click('[data-count="4"]'); await q.click('[data-mode="multi"]');
  for (const id of ['spriggan', 'bahamut', 'excalibur', 'longinus']) { await q.click(`.card[data-id="${id}"]`); await q.click('#selOk'); }
  await q.waitForTimeout(400); await q.screenshot({ path: path.join(out, `${name}-ffa-ready.png`) });
  await ctx.close();
}
await b.close();
console.log(JSON.stringify({ n: res.n, pct: res.pct, dur: res.dur, radius: res.radius.filter(r => [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10].includes(r.t)), errors }, null, 1));
