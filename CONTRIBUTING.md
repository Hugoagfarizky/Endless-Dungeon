# Panduan Kontribusi

Endless Dungeon adalah game web roguelike taktis yang dibangun dengan HTML5 Canvas, CSS, dan Vanilla JavaScript: tanpa framework, tanpa build step, dan tanpa dependency eksternal. Kontribusi berupa laporan bug, perbaikan AI dan balance, peningkatan aksesibilitas, serta dokumentasi sangat diterima.

## Menjalankan secara lokal

Game bisa dibuka langsung dari `index.html`, tetapi server statis lebih nyaman saat debugging:

```bash
python -m http.server 8080
# atau
npx serve .
```

Lalu buka <http://localhost:8080>.

## Struktur berkas

| Direktori / Berkas | Isi |
| --- | --- |
| `index.html` | kerangka UI, dialog, dan urutan pemuatan CSS & `<script defer>` |
| `css/tokens-base.css`, `css/hud.css`, `css/modals.css` | tema batu gothic, floating HUD, modal dialog, dan aturan responsif |
| `js/data/catalogs.js` | katalog zirah, set bonus, relic, item, bestiary, dan template party |
| `js/core/persistence.js` | Hall of Fame, save/load slot, export/import JSON, seed, dan ascension |
| `js/party/` (`party-stats.js`, `loot-forge.js`) | atribut hero, perk/mastery, formasi, loot generator, dan forge |
| `js/world/` (`grid.js`, `exploration.js`, `events.js`) | generator ruangan, pergerakan party, trap/peti, merchant/shrine/campfire |
| `js/combat/` (`combat-engine.js`, `combat-actions.js`) | antrean giliran, reaksi elemen, jurus 4 kelas hero, dan AI boss |
| `js/render/` (`material-baker.js`, `environment.js`, `characters.js`, `monsters.js`, `lighting-fog.js`) | tekstur 3D normal-mapped, anatomi hero & monster, raycast pencahayaan |
| `js/ui/` (`icons.js`, `camera-vfx.js`, `hud.js`, `modals.js`, `scene-loop.js`) | ilustrasi SVG, kamera/VFX, HUD, modal, dan loop render 60 FPS |
| `js/audio/sound.js` | sintesis Web Audio API, cavern reverb, dan musik adaptif |
| `js/main.js` | input keyboard/mouse dan inisialisasi permainan |
| `GDD.docx` | acuan desain; tanya dulu sebelum mengubah aturan inti |

Script dimuat berurutan lewat tag `<script defer>` biasa (tanpa bundler atau build step). Jangan mengubah urutan di `index.html` tanpa memperhatikan ketergantungan antar-modul.

## Sebelum mengirim perubahan

- Buka DevTools dan pastikan console bersih dari error.
- Uji di 1280x720, mode fullscreen, dan minimal satu ukuran layar kecil.
- Jangan menambah dependency, framework, atau build step. Semua aset harus tetap jalan dari GitHub Pages.
- Jaga target 60 FPS: hindari alokasi objek baru di dalam loop render.
- Audio hanya boleh berbunyi setelah interaksi pengguna, sesuai kebijakan autoplay browser.
- Kalau mengubah format save (`endless_dungeon_save_v2_slot_*`), sertakan migrasi dari save lama supaya progres pemain tidak hilang.
- Jangan commit aset yang lisensinya tidak jelas. Sebutkan sumber aset baru di deskripsi pull request.

## Gaya kode

- JavaScript biasa dengan `const`/`let`, tanpa `var` dan tanpa transpiler.
- Taruh logika permainan di modul `js/` yang sesuai, bukan menumpuk di `main.js`.
- Satu fungsi satu tanggung jawab. Beri komentar singkat untuk rumus damage, perilaku AI, dan hal yang tidak langsung terlihat.
- Nama variabel dan komentar dalam bahasa Inggris; teks antarmuka mengikuti bahasa yang sudah ada di `index.html`.

## Alur kontribusi

1. Buat branch: `git checkout -b fix/nama-singkat`.
2. Commit mengikuti Conventional Commits, misalnya `fix(combat): hentikan enrage boss saat stun`.
3. Buka pull request ke `main`. Jelaskan **apa**, **kenapa**, dan cara mengujinya. Untuk perubahan visual, sertakan screenshot atau rekaman singkat.

Untuk laporan bug, sertakan langkah reproduksi, browser, ukuran layar, dan seed run bila ada. Untuk masalah keamanan, ikuti [SECURITY.md](SECURITY.md) dan jangan membuka issue publik.

## Lisensi

Dengan mengirim pull request, kontribusimu dirilis di bawah [MIT License](LICENSE).
