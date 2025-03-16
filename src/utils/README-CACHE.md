# Dokumentasi Caching dengan Node-Cache

## Pengenalan

Sistem caching diimplementasikan menggunakan node-cache untuk meningkatkan performa aplikasi dengan menyimpan hasil query database yang sering diakses. Caching mengurangi beban server dan mempercepat respons API.

## Teknologi

Caching menggunakan `node-cache`, library in-memory caching sederhana namun powerful untuk Node.js dengan fitur:
- Performa tinggi karena bekerja di memory aplikasi tanpa dependensi eksternal
- Kontrol TTL (Time-To-Live) yang fleksibel untuk setiap key
- Pembersihan otomatis untuk item yang expired
- Pencegahan memory leak dengan fitur `maxKeys`
- Dukungan untuk tipe data yang kompleks

## Konfigurasi

Konfigurasi caching disimpan di file `.env`:
```
CACHE_TTL=300  # Default time-to-live dalam detik (5 menit)
```

## Implementasi yang Dioptimalkan

Caching diimplementasikan dengan optimasi berikut:
- `useClones: false` - Menyimpan referensi data langsung untuk performa lebih baik (menghindari serialisasi)
- `deleteOnExpire: true` - Hapus otomatis data yang expired untuk manajemen memori yang baik
- `maxKeys: 10000` - Batasi jumlah item dalam cache untuk mencegah memory leak
- Error handling yang komprehensif di setiap fungsi cache

## Struktur Caching

File utama:
- `src/utils/cache.ts`: Utilitas dasar caching (get, set, delete)
- `src/utils/cacheStats.ts`: Fungsi untuk monitoring statistik cache

### Fungsi Utama

1. `getCachedData<T>(key: string)`: Mendapatkan data dari cache
2. `setCachedData<T>(key: string, data: T, ttl?: number)`: Menyimpan data ke cache
3. `deleteCachedData(key: string)`: Menghapus data dari cache
4. `deleteCachedDataByPattern(pattern: string)`: Menghapus data dari cache berdasarkan pattern
5. `clearCache()`: Membersihkan seluruh cache
6. `cacheMiddleware(keyPrefix: string, ttl?: number)`: Middleware untuk implementasi caching pada API
7. `getCacheStats()`: Mendapatkan statistik penggunaan cache

## Monitoring dan Statistik

Endpoint `/api/cache-stats` (untuk admin) menyediakan informasi:
- Jumlah item dalam cache
- Hit ratio (persentase cache hit dari total request)
- Hit dan miss count
- Ukuran total cache dalam memori
- Daftar key berdasarkan pattern (opsional)

## Penggunaan

### Middleware Caching

Middleware caching digunakan pada route yang sering diakses dan tidak sering berubah:

```typescript
router.get('/', cacheMiddleware('fields', 300), getAllFields);
```

Parameter:
- `keyPrefix`: Prefix untuk key cache
- `ttl`: Time-to-live dalam detik (opsional)

### Invalidasi Cache

Cache dihapus ketika data berubah (create, update, delete):

```typescript
deleteCachedDataByPattern('fields');
deleteCachedDataByPattern('admin_fields');
```

## Endpoint dengan Caching

1. **Fields**
   - `GET /api/fields` - TTL: 300 detik (5 menit)
   - `GET /api/fields/availability` - TTL: 60 detik (1 menit)
   - `GET /api/fields/admin` - TTL: 300 detik (5 menit)
   - `GET /api/fields/admin/:id` - TTL: 300 detik (5 menit)

2. **Branches**
   - `GET /api/branches` - TTL: 300 detik (5 menit)

3. **Users**
   - `GET /api/users/all` - TTL: 300 detik (5 menit)
   - `GET /api/users/branch` - TTL: 300 detik (5 menit)
   - `GET /api/users/owner` - TTL: 300 detik (5 menit)

4. **Field Types**
   - `GET /api/field-types` - TTL: 600 detik (10 menit)

5. **Bookings**
   - `GET /api/bookings/users/:userId/bookings` - TTL: 120 detik (2 menit)
   - `GET /api/bookings/bookings/:id/user` - TTL: 120 detik (2 menit)
   - `GET /api/bookings/branches/:branchId/bookings` - TTL: 60 detik (1 menit)
   - `GET /api/bookings/branches/:branchId/bookings/:id` - TTL: 60 detik (1 menit)
   - `GET /api/bookings/admin/bookings` - TTL: 120 detik (2 menit)
   - `GET /api/bookings/admin/bookings/:id` - TTL: 60 detik (1 menit)
   - `GET /api/bookings/admin/bookings/stats` - TTL: 300 detik (5 menit)
   - `GET /api/bookings/owner/branches/:branchId/bookings` - TTL: 120 detik (2 menit)
   - `GET /api/bookings/owner/branches/:branchId/bookings/:id` - TTL: 60 detik (1 menit)

6. **Activity Logs**
   - `GET /api/activity-logs` - TTL: 300 detik (5 menit)

7. **Promotions**
   - `GET /api/promotions` - TTL: 300 detik (5 menit)

8. **Field Reviews**
   - `GET /api/field-reviews` - TTL: 300 detik (5 menit)

## Strategi Caching

1. **Data Statis atau Jarang Berubah**
   - Tipe lapangan (field-types) - TTL: 600 detik (10 menit)
   - Daftar pengguna (users) - TTL: 300 detik (5 menit)
   - Cabang (branches) - TTL: 300 detik (5 menit)
   - Promosi (promotions) - TTL: 300 detik (5 menit)
   
2. **Data Semi-Dinamis**
   - Lapangan (fields) - TTL: 300 detik (5 menit)
   - Statistik booking - TTL: 300 detik (5 menit)
   - Log aktivitas (activity-logs) - TTL: 300 detik (5 menit)
   - Review lapangan (field-reviews) - TTL: 300 detik (5 menit)

3. **Data Dinamis**
   - Booking - TTL: 60-120 detik (1-2 menit)
   - Ketersediaan lapangan - TTL: 60 detik (1 menit)

## Praktik Terbaik

1. **Gunakan caching untuk data yang:**
   - Sering diakses
   - Jarang berubah
   - Memerlukan query database yang berat

2. **Hindari caching untuk data yang:**
   - Sangat dinamis (perubahan per detik)
   - Spesifik untuk pengguna tertentu (kecuali dengan key yang tepat)
   - Sensitif terhadap keamanan

3. **Invalidasi Cache:**
   - Selalu hapus cache yang relevan ketika data berubah
   - Gunakan pattern yang konsisten untuk penamaan key
   - Sertakan error handling pada proses invalidasi

## Tips Performa

1. **Buat key yang efisien**
   - Gunakan key yang bermakna namun pendek
   - Hindari key yang terlalu panjang

2. **Sesuaikan TTL dengan karakteristik data**
   - Data yang sering berubah = TTL pendek
   - Data statis = TTL panjang

3. **Pantau penggunaan cache**
   - Gunakan endpoint `/api/cache-stats` untuk monitoring
   - Perhatikan hit-ratio dan memori yang digunakan

4. **Hindari menyimpan objek yang terlalu besar**
   - Cache hanya data yang diperlukan, tidak semua properties objek
   - Pertimbangkan fragmentasi cache untuk objek besar 