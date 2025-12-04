Bope — WhatsApp Auto Messenger

Deskripsi
Sebuah bot pengirim pesan otomatis untuk WhatsApp yang dapat mengirim pesan berdasarkan jadwal (waktu, hari, atau tanggal), dengan dukungan pengecualian nomor dan pengaturan terpusat.

Fitur
- **Kirim Pesan Otomatis:** Kirim pesan pada waktu yang ditentukan (mis. `08:00`).
- **Penjadwalan Berdasarkan Hari:** Kirim pada hari tertentu (mis. Senin–Jumat).
- **Penjadwalan Berdasarkan Tanggal/Kalender:** Dukungan untuk tanggal spesifik atau event kalender.
- **Target Tertentu:** Kirim ke nomor atau grup tertentu.
- **Pengecualian Nomor:** Atur daftar nomor yang tidak akan dikirimi pesan.

Teknologi
- **Node.js**
- **Baileys** (WhatsApp Web API)
- **MySQL** untuk menyimpan data nomor dan metadata pengguna
- **File JSON** untuk menyimpan aturan/jadwal (`config/rules.json`)
- **node-cron** untuk scheduling (cron job)