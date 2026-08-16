# Sprint-048 — Outbox Dispatcher

## Amaç

Sprint-047 ile oluşturulan transactional outbox kayıtlarını güvenli biçimde Event Bus'a taşıyan dispatcher katmanını kurmak.

Bu sprintte veritabanı polling mantığını Event Bus implementasyonundan ayırıyoruz.

## Tasarım

Akış:

1. `OutboxStore.getPending(limit)` ile yayınlanmamış kayıtlar alınır.
2. Her kayıt `OutboxPublisher.publish(event)` ile yayınlanır.
3. Publish başarılıysa `OutboxStore.markPublished(id)` çağrılır.
4. Publish başarısızsa event published olarak işaretlenmez.
5. Bir event'in başarısız olması batch içindeki diğer event'lerin işlenmesini engellemez.
6. Dispatcher `dispatchOnce()` ile tek batch çalıştırır; scheduler bu katmanın dışında kalır.
7. `maxBatchSize` pozitif integer olmalıdır.

## Önemli

Bu sprintte PostgreSQL polling scheduler veya cron eklemiyoruz.
Önce dispatcher davranışını izole edip test ediyoruz.

## Test

```powershell
pnpm install
pnpm test
```

Testler başarılı olmadan commit yapma.

Başarılıysa:

```powershell
git status
git add .
git commit -m "feat: add transactional outbox dispatcher"
git push
```
