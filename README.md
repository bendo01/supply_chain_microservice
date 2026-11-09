# Supply Chain Microservice

Sistem rantai pasok berbasis microservice yang mencakup alur **pembeli → retail → warehouse → supplier**. Pembeli membayar di retail secara tunai atau QRIS (simulasi). Bila stok retail menipis, manajer retail meminta restock ke warehouse dan barang dikirim melalui distribusi. Bila stok warehouse habis, warehouse memesan ke supplier. Dashboard menampilkan penjualan, laba-rugi, dan analisis barang terjual untuk seluruh retail maupun per retail.

> **Status**: Gateway (`ms_01_gateaway`, Laravel) sudah diimplementasikan; service lain masih berupa **dokumentasi desain**. Dokumen menjadi acuan untuk implementasi tiap service.

## Arsitektur singkat

| No | Service | Tanggung jawab |
|---|---|---|
| 01 | Gateway (`ms_01_gateaway`) | Pintu masuk API: autentikasi JWT, otorisasi per peran, routing |
| 02 | Commodity | Master barang, kategori, harga jual, dan HPP |
| 03 | Payment | Pembayaran tunai dan QRIS (simulasi) |
| 04 | Retail | Kasir (POS), stok retail, permintaan restock, dashboard |
| 05 | Distribution | Pengiriman dari warehouse ke retail |
| 06 | Warehouse | Stok gudang, pemenuhan restock, pemesanan ke supplier |
| 07 | Supplier (`ms_07_supplyer`) | Master supplier dan purchase order |

Prinsip desain:
- Setiap service memiliki database RDBMS sendiri (mis. PostgreSQL atau MySQL/MariaDB); bahasa pemrograman bebas per service.
- Klien hanya mengakses sistem lewat Ferron (web server/reverse proxy) dan Gateway.
- Komunikasi sinkron memakai REST; perubahan status antar service memakai event melalui RabbitMQ. Alternatif tanpa RabbitMQ dijelaskan di SRS global bagian 4.2.
- Deployment tanpa Docker: tiap service berjalan sebagai service systemd.

Nama folder `ms_01_gateaway` dan `ms_07_supplyer` sengaja dipertahankan sesuai repositori; di dokumen ditulis *Gateway* dan *Supplier*.

## Dokumentasi

Mulailah dari dokumen global, lalu lanjut ke service yang relevan.

- **Global**: [documentation/software_requirement_specification.md](documentation/software_requirement_specification.md) berisi skenario, aktor, arsitektur, kebutuhan, katalog event, panduan pembuatan, dan strategi pengembangan paralel. Versi PDF gabungan seluruh dokumen: [documentation/supply_chain_microservice_SRS_lengkap.pdf](documentation/supply_chain_microservice_SRS_lengkap.pdf).
- **Per service** (fungsi, endpoint, model data, event, dan cara pembuatan):
  - [ms_01_gateaway](ms_01_gateaway/documentation/software_requirement_specification.md)
  - [ms_02_commodity](ms_02_commodity/documentation/software_requirement_specification.md)
  - [ms_03_payment](ms_03_payment/documentation/software_requirement_specification.md)
  - [ms_04_retail](ms_04_retail/documentation/software_requirement_specification.md)
  - [ms_05_distribution](ms_05_distribution/documentation/software_requirement_specification.md)
  - [ms_06_warehouse](ms_06_warehouse/documentation/software_requirement_specification.md)
  - [ms_07_supplyer](ms_07_supplyer/documentation/software_requirement_specification.md)

Diagram (use case, ER, sequence, activity, state, komponen, deployment) ditulis dalam PlantUML (`.puml`) dan dirender ke `.svg` di folder `documentation` masing-masing. Setiap SRS juga memuat gambar diagramnya di bagian "Lampiran Gambar Diagram".

## Membuat ulang diagram

Setelah mengubah file `.puml`, render ulang dengan [PlantUML](https://plantuml.com):

```
plantuml -tsvg <file>.puml
```

Untuk memeriksa sintaks saja: `plantuml -checkonly <file>.puml`. File `.svg` dan PDF tidak diperbarui otomatis, jadi buat ulang keduanya setelah dokumen berubah.
