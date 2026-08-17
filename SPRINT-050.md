# Sprint-050 — Outbox Event Leasing ve Lease Recovery

## Amaç

Transactional outbox dispatcher yapısını çoklu worker ortamında güvenli hale getirmek.

Sprint-048 ve Sprint-049 ile oluşturulan outbox dispatcher/publisher altyapısına lease mekanizması eklenerek aynı outbox event'inin aynı anda birden fazla worker tarafından işlenmesi engellenir. Worker başarısız olursa veya çalışmayı durdurursa süresi dolan lease başka bir worker tarafından yeniden alınabilir.

## Tasarım

Akış:

1. `OutboxStore.claimPending(owner, limit, leaseDurationMs)` ile yayınlanmamış ve claim edilebilir event'ler alınır.
2. Event claim edildiğinde `lease_owner` worker kimliğiyle doldurulur.
3. `lease_until` alanı lease'in son geçerlilik zamanını belirler.
4. Aktif lease'e sahip event başka bir worker tarafından claim edilemez.
5. `lease_until` süresi geçtiğinde event yeniden claim edilebilir.
6. Claim işlemi PostgreSQL tarafında `FOR UPDATE SKIP LOCKED` kullanır.
7. Claim sırasında `attempts` değeri artırılır.
8. Publish başarılı olduğunda yalnızca lease sahibi worker `markPublished(id, owner)` çağrısıyla event'i published olarak işaretleyebilir.
9. Başarılı publish sonrasında `lease_owner` ve `lease_until` temizlenir.
10. Publish başarısız olursa event published olarak işaretlenmez; lease süresi dolduğunda yeniden işlenebilir.
11. Dispatcher owner, lease süresi ve batch boyutunu doğrular.
12. Dispatcher lifecycle (`start` / `stop`) korunur ve polling hataları worker'ı sonlandırmaz.

## Veritabanı

Outbox tablosuna lease alanları eklendi:

- `lease_owner TEXT NULL`
- `lease_until TIMESTAMPTZ NULL`

Migration:

```text
packages/core/src/infrastructure/sql/002_add_outbox_leases.sql
```

## Kod

### Port

```text
packages/core/src/infrastructure/ports/outbox.ts
```

`PendingOutboxEvent` içine:

- `leaseOwner`
- `leaseUntil`

eklendi.

`OutboxStore` içine:

- `claimPending(...)`
- `markPublished(id, owner)`

eklendi.

### PostgreSQL Adapter

```text
packages/core/src/infrastructure/adapters/postgresql/postgresql-outbox-store.ts
```

Eklenen davranışlar:

- Lease bilgilerini okuma
- Pending event claim etme
- Aktif lease kontrolü
- Expired lease recovery
- Owner doğrulaması
- Lease duration doğrulaması
- Owner kontrollü publish marking

### Dispatcher

```text
packages/core/src/infrastructure/application/outbox-dispatcher.ts
```

Dispatcher artık:

- `owner`
- `leaseDurationMs`
- `maxBatchSize`
- `pollIntervalMs`

ile çalışır.

Her polling döngüsünde önce event'ler claim edilir, ardından publish edilir ve başarılı event'ler yalnızca ilgili worker owner'ı ile published olarak işaretlenir.

## Test

PostgreSQL outbox testlerine şu davranışlar eklendi:

- Aktif lease'e sahip event'in claim edilmemesi
- Süresi dolmuş lease'in yeniden claim edilebilmesi

Dispatcher testleri ayrıca:

- Owner kullanımı
- Lease duration aktarımı
- Owner doğrulaması
- Lease duration doğrulaması
- Batch/poll validation
- Start/stop lifecycle

davranışlarını doğrular.

Test komutu:

```powershell
pnpm test
```

Sonuç:

```text
tests 63
pass  63
fail  0
cancelled 0
skipped 0
todo 0
```

## Commitler

```text
2c8c188 feat: add outbox event leasing
3ccd2d9 test: verify outbox lease recovery
```

## Durum

Sprint-050 tamamlandı.

- Build başarılı
- 63/63 test başarılı
- Lease recovery testleri başarılı
- Commit edildi
- GitHub `main` branch'ine push edildi
