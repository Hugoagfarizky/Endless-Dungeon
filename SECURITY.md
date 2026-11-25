# Kebijakan Keamanan

Endless Dungeon adalah game web statis: tidak ada backend, tidak ada akun, dan tidak ada data yang dikirim keluar. Progres, pengaturan audio, dan Hall of Fame disimpan di `localStorage` browser.

## Melaporkan celah

- **Jangan** membuka issue publik untuk masalah keamanan.
- Kirim email ke **nugrahaagfarizky@gmail.com** dengan subjek `[SECURITY] Endless-Dungeon`.
- Sertakan langkah reproduksi, browser dan versinya, dampak yang mungkin terjadi, serta proof of concept bila ada.

Balasan awal biasanya dalam beberapa hari. Perbaikan dikirim ke `main` dan ikut di build terbaru di <https://hugoagfarizky.github.io/Endless-Dungeon/>.

## Cakupan

- Cross-site scripting lewat impor save JSON, nama party, atau teks seed run.
- Penanganan data save yang tidak aman, misalnya objek dengan prototipe aneh saat impor.
- Permintaan jaringan yang tidak diharapkan; seharusnya tidak ada sama sekali.
- Kerentanan pada aset pihak ketiga, bila nanti ada yang ditambahkan.

## Di luar cakupan

- Kehilangan progres karena membersihkan data situs, mode incognito, atau kuota `localStorage` penuh.
- Cheat atau modifikasi save di perangkat sendiri; game ini offline dan single-player.
- Denial of service, karena tidak ada server.
