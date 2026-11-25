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

| Berkas | Isi |
| --- | --- |
| `index.html` | kerangka UI, dialog, dan urutan pemuatan script |
| `style.css` | tema gothic, layout responsif, animasi HUD |
| `js/grid.js` | generator ruangan prosedural, biome, boss, fog of war |
| `js/player.js` | party, zirah, relic, skill, dan penyimpanan save |
| `js/combat.js` | sistem giliran, AI boss, reaksi elemen |
| `js/renderer.js` | tekstur 2.5D, miniatur karakter, pencahayaan |
| `js/ui.js` | HUD, minimap, modal, dan alur save/load |
| `js/sound.js` | sintesis Web Audio dan musik adaptif |
| `js/main.js` | input keyboard/mouse dan inisialisasi |
| `GDD.docx` | acuan desain; tanya dulu sebelum mengubah aturan inti |

Script dimuat berurutan lewat tag `<script>` biasa, bukan ES module. Jangan mengubah urutan di `index.html` tanpa alasan yang jelas.

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
