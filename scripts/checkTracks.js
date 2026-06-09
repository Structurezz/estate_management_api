const https = require('https');
const tracks = require('../data/defaultTracks');

function checkVideo(videoId) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try   { resolve({ ok: true, ytTitle: JSON.parse(data).title }); }
          catch { resolve({ ok: false, code: 'bad_json' }); }
        } else {
          resolve({ ok: false, code: res.statusCode });
        }
      });
    }).on('error', e => resolve({ ok: false, code: e.message }));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log(`\nChecking ${tracks.length} tracks…\n`);
  const bad = [];
  const good = [];

  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    const r = await checkVideo(t.videoId);
    if (r.ok) {
      console.log(`✅  [${String(i+1).padStart(2,'0')}] ${t.videoId}  ${t.title} — "${r.ytTitle}"`);
      good.push(t);
    } else {
      console.log(`❌  [${String(i+1).padStart(2,'0')}] ${t.videoId}  ${t.title}  (${r.code})`);
      bad.push({ ...t, code: r.code });
    }
    if (i < tracks.length - 1) await sleep(120); // stay polite to YouTube
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  ✅  Valid  : ${good.length}`);
  console.log(`  ❌  Invalid: ${bad.length}`);
  if (bad.length) {
    console.log('\n  Tracks that need correct IDs:');
    bad.forEach(t => console.log(`     • "${t.title}" — ${t.artist}  (tried: ${t.videoId})`));
  }
  console.log('══════════════════════════════════════════════════════\n');
}

main();
