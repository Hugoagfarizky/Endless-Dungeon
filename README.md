# ⚜️ Endless Dungeon — Dark Fantasy Tactical RPG

**Endless Dungeon** adalah game web *2.5D Top-Down Tactical Turn-Based Roguelike RPG* bertema *Dark Fantasy* Abad Pertengahan yang dibangun murni menggunakan **HTML5 Canvas, CSS3, dan Vanilla JavaScript** tanpa *dependency* eksternal. Pimpin sebuah Ordo beranggotakan 4 Ksatria menembus lantai ruang bawah tanah tak terbatas, kelola sumber daya obor, tempa zirah legendaris, dan taklukkan para *Dread Lord* di setiap kedalaman biome!

---

## ✨ Fitur Utama

### 🎨 Visual 2.5D Realistis & Pencahayaan Dinamis
- **Tekstur Batu & Material Prosedural Hi-DPI (2x Retina)**: Ubin lantai batu pahat (*flagstone*), lumut lembap, genangan air reflektif, urat es kristal, rekahan magma pijar, serta dinding *ashlar* 3D lengkap dengan *ambient occlusion* dan bayangan arah.
- **Miniatur Karakter & Monster Bergradasi**: Ilustrasi 2.5D detail untuk keempat kelas ksatria (*Warrior, Ranger, Cleric, Battlemage*), monster (*Translucent Slime, Undead Halberdier, Cursed Mimic*), serta *Mini-Boss* & *Grand Boss* tiap biome.
- **Volumetric Multi-Light & Feathered Fog of War**: Pencahayaan dinamis *real-time* dari obor ksatria, obor dinding berkobar, api unggun, kristal altar, lentera pedagang, hingga proyektil sihir di tengah pertempuran.

### ⚔️ Pertarungan Taktis Berbasis Giliran (Turn-Based Combat)
- **Formasi Frontline & Backline**: Atur posisi barisan ksatria dan taktik formasi (*Balanced, Aggressive, Defensive*) untuk bonus serangan jarak dekat atau mitigasi pertahanan.
- **Reaksi Elemen & Combo Counter**: Padukan status *Burn, Poison, Break,* dan *Stun* untuk memicu ledakan kombo elemen (*Toxic Blast, Shatter, Thermal Shock, Toxic Spasm*) serta *Overdrive Ultimate Cut-In* sinematik!
- **4 Biome Dinamis & Boss Bertahap**: *Abandoned Crypt*, *Frozen Cavern*, *Infernal Core*, dan *Void Abyss* dengan musik latar prosedural berbeda, bahaya lingkungan, *Mini-Boss* tiap Lantai 5, dan *Grand Boss* (2 Fase + Enrage) tiap Lantai 10.

### 🛡️ Progresi RPG Mendalam & Meta-Progression
- **Royal Armory & Blacksmith Forge**: Kumpulkan *Equipment Set* (2-Pc & 4-Pc Bonus), *Cursed Relics*, *Runes*, dan *Boss Charms*, serta tempa zirah menggunakan *Damascus Iron Ore*.
- **Skill Tree, Perks & Mastery Art**: Alokasikan poin atribut, *Knightly Vows (Perks)*, *Mastery Skill Tree*, dan buka jurus kedua pada Level 5.
- **Royal Codex, Ascension, Prestige & Seed/Daily Run**: Rekor *Hall of Fame*, *Bestiary Mastery* (+10% DMG permanen per spesies), *Achievements*, *3 Save Slots* (lengkap dengan JSON Export/Import), serta tantangan *Seed* deterministik.

### 🔊 Audio Web Sintetis dengan Cavern Reverb
- Mesin audio **Web Audio API** murni dengan *Procedural Stone Cavern Impulse Reverb*, efek suara berbasis fisika (*footsteps*, denting tempaan paron, tebasan baja), dan sekuenser musik adaptif per biome & pertempuran.

---

## 🎮 Kontrol Permainan

| Tombol / Aksi | Fungsi |
| :--- | :--- |
| `W A S D` / `Panah` / **Klik Peta** | Menggerakkan Ordo Ksatria / Interaksi Objek |
| `1` / `2` / `8` / `6` | Strike / Primary Art / Mastery Art (Lv.5) / Ultimate Art |
| `3` / `7` / `0` | Raise Guard / Reposition Barisan / Mundur dari Pertempuran |
| `Tab` / **Klik Musuh** | Mengganti Target Prioritas |
| `B` / `E` / `C` / `P` | Satchel Ramuan / Royal Armory & Forge / Royal Codex / Save Slots |
| `M` / `G` / `K` / `T` / `V` | Radar Minimap / Auto-Battle / Strategi AI / Taktik Formasi / Kecepatan (`x1–x3`) |
| `R` / `Esc` | Pengaturan Seed Run / Menu Pause |

---

## 🚀 Cara Menjalankan Secara Lokal

Cukup buka berkas `index.html` langsung di peramban modern (Chrome, Edge, Firefox, Safari), atau jalankan server statis lokal:

```bash
npx serve .
# atau menggunakan Python:
python -m http.server 8080
```

Lalu buka `http://localhost:8080` di browser.

---

## 📂 Struktur Proyek

```text
Endless Dungeon/
├── index.html       # Antarmuka utama & modal <dialog> aksesibel
├── style.css        # Tema Gothic Dark-Fantasy, layout responsif & animasi UI
├── GDD.docx         # Dokumen Konsep Game (Game Design Document)
├── js/
│   ├── sound.js     # Web Audio API synth, cavern reverb & BGM dinamis
│   ├── grid.js      # Generator ruangan prosedural, biome, boss, & Fog of War
│   ├── player.js    # Party 4 ksatria, zirah, set bonus, relic, & penyimpanan
│   ├── combat.js    # Sistem turn-based, AI boss 2 fase, reaksi elemen & taktik
│   ├── renderer.js  # Engine tekstur batu 2.5D, miniatur karakter & pencahayaan
│   ├── ui.js        # Loop render 60 FPS, HUD, minimap radar, & sistem modal
│   └── main.js      # Kontrol input keyboard/mouse & inisialisasi permainan
└── assets/          # Direktori aset tambahan
```
