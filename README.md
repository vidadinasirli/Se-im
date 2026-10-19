# Abituriyent hazırlığı

Next.js App Router, TypeScript, Tailwind CSS və Prisma ilə qurulmuş imtahan hazırlığı saytı. İstifadəçi interfeysi Azərbaycan dilindədir.

## Qovluq quruluşu

```text
app/
  api/chat/              Groq söhbət və cavab rəyi
  api/cron/agent-signals/ LLM-siz siqnal toplama nöqtəsi
  api/cron/admin-agent/   Növbədəki fürsətin qərar və yayım nöqtəsi
  api/cron/agent-maintenance/ GA4 səhifə keyfiyyəti yoxlaması
  admin/                İnzibatçı paneli və dəyişiklik qərarları
  api/cron/refresh-content/  Qorunan məzmun yeniləmə nöqtəsi
  api/cron/dim-calendar/     Gündəlik DİM təqvim yeniləmə nöqtəsi
  imtahan-teqvimi/      Təsdiqlənmiş imtahan tarixləri
  testler/[group]/      İndekslənən fənn və mövzu testləri
  guide/[slug]/         Agent tərəfindən yaradılmış bələdçi səhifələri
  valyuta/[slug]/       Rəsmi məzənnə ilə interaktiv çevirmə səhifəsi
  globals.css
  layout.tsx
  page.tsx
jobs/
  refresh-content.ts    Mənbə → AI → müqayisə → nəşr axını
  dim-calendar.ts       DİM tarixlərini çıxarır və təsdiq növbəsinə yazır
  generate-question-drafts.ts  AI suallarını nəzarətli qaralama kimi yaradır
lib/
  ai.ts                 AI provayder abstraksiyası və Zod yoxlaması
  chat-search.ts        Saytın öz məzmunu üzrə SQLite FTS5 axtarışı
  chat-rate-limit.ts    IP üzrə dəqiqəlik/gündəlik limit
  cron-auth.ts          Vercel Cron açarının yoxlanması
  prisma.ts             Prisma Client
  question-schema.ts    Test sualları və qruplarının sxemi
prisma/
  schema.prisma         SQLite sxemi
  seed.mjs              Yoxlanılmış nümunə Riyaziyyat sualları
app/sitemap.ts          Sitemap
app/robots.ts           Robots qaydaları
middleware.ts           Admin Basic Auth
vercel.json             DİM, məzmun və agent Cron cədvəli
jobs/collect-agent-signals.ts  LLM çağırmadan analitika, axtarış və rəsmi mənbə siqnalları
jobs/admin-agent.ts     Fürsət qərarı, məzmun istehsalı və keyfiyyət qapısı
app/admin/agent-control-panel.tsx  Canlı agent jurnalı və yayım siyasəti
```

## Quraşdırma

1. Node.js 20 və ya daha yeni versiyanı quraşdırın.
2. Asılılıqları quraşdırın:

   ```bash
   npm install
   ```

3. `.env.example` faylını `.env` adı ilə köçürün və `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `ADMIN_PASSWORD`, `CRON_SECRET`, `GROQ_API_KEY`, `GROQ_MODEL` dəyərlərini doldurun. Məzmun mənbələrini `CONTENT_SOURCE_URLS` dəyişənində vergüllə, DİM-in rəsmi elan səhifəsinin tam ünvanını isə `DIM_EXAM_SOURCE_URL` dəyişənində göstərin. IP limitinin açarı üçün `CHAT_RATE_LIMIT_SECRET` təyin edin; boş saxlanarsa `CRON_SECRET` istifadə olunur.
4. SQLite sxemini yaradın və Prisma Client-i hazırlayın:

   ```bash
   npm run db:push
   npm run db:generate
   ```

   Mövcud SQLite bazasında chatbotun `ChatKnowledgeFts` virtual cədvəli varsa, `db push` bu cədvəli silmək barədə xəbərdarlıq edə bilər. Mövcud məlumatı qorumaq üçün agent cədvəllərini yalnız bir dəfə əlavə edən `prisma/migrations/20250308000000_admin_ai_agent/migration.sql` skriptini `npx prisma db execute --file prisma/migrations/20250308000000_admin_ai_agent/migration.sql --schema prisma/schema.prisma` əmri ilə tətbiq edin; bu skript FTS5 cədvəllərinə toxunmur. `--accept-data-loss` istifadə etməyin.

5. Nümunə testləri əlavə edin:

   ```bash
   npm run db:seed
   ```

6. İnkişaf serverini başladın:

   ```bash
   npm run dev
   ```

Admin paneli `/admin` ünvanındadır və `ADMIN_PASSWORD` ilə HTTP Basic Auth vasitəsilə qorunur. Vercel Cron `CRON_SECRET` dəyərini `Authorization: Bearer ...` başlığı ilə göndərir.

İmtahan təqvimi `/imtahan-teqvimi`, Riyaziyyat üzrə 9-cu sinif Cəbr testləri isə `/testler/riyaziyyat-9-cu-sinif-cebr` ünvanındadır. Test nəticələri giriş tələb etmədən brauzerin `localStorage` yaddaşında saxlanılır. `/admin` panelində yaradılan AI sualları yoxlanıb təsdiqlənənədək dərc olunmur.

DİM Cron hər gün saat 05:00 UTC-də yalnız `dim.gov.az` domenindəki `DIM_EXAM_SOURCE_URL` səhifəsini oxuyur. Tarix və qeydiyyat məlumatları dəyişəndə dəyişiklik yüksək risk kimi saxlanılır; təqvimə və ana səhifə geri sayımına yalnız inzibatçı təsdiqindən sonra düşür. Rəsmi səhifə ünvanı və AI açarları yerləşdirmə mühitində sazlanmalıdır.

## Admin AI Agent

Agentin birinci mərhələsi `/api/cron/agent-signals` vasitəsilə GA4, Search Console, Google Trends AZ RSS-i, sayt axtarış qeydləri, cavabsız söhbətlər, DİM təqvimi və Azərbaycan Mərkəzi Bankının TRY məzənnəsindən siqnallar toplayır; bu mərhələdə LLM çağırılmır. İkinci mərhələ `/api/cron/admin-agent` vasitəsilə növbədəki bir fürsəti emal edir. Hər iki nöqtə `CRON_SECRET` ilə qorunur və `AgentLog` qeydi yaradır.

Vercel-də `GOOGLE_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID`, `GSC_SITE_URL`, `GOOGLE_TRENDS_RSS_URL`, `CBAR_RATE_URL`, `GROQ_API_KEY`, `GROQ_MODEL`, `INDEXNOW_KEY` və `NEXT_PUBLIC_SITE_URL` dəyişənlərini sazlayın. Google xidmət hesabına GA4 oxuma və Search Console oxuma icazəsi verilməlidir. `CBAR_RATE_URL` boş saxlanarsa agent Azərbaycan Mərkəzi Bankının rəsmi tarixli XML ünvanlarını yoxlayır. Xarici mənbələr üçün robots.txt yoxlanılır, sorğular arasında gözləmə və tanıdıcı User-Agent tətbiq olunur.

Hər dəqiqəlik cron Vercel-in uyğun planını tələb edə bilər; yerləşdirmə planı bu sıxlığı dəstəkləmirsə, Cron tezliyini planın icazə verdiyi intervala uyğunlaşdırın. Agent gündə ən çox bir fürsəti LLM-ə göndərir, gündəlik token büdcəsini və yayım siyasətini `/admin` panelindən tətbiq edir. `KILL SWITCH` avtomatik qərar və yayımı dayandırır, siqnal toplama isə davam edir. Aşağı riskli, fakt-yoxlamadan keçmiş və siyasətdəki etibar həddinə çatan məzmun avtomatik yayımlana bilər; digər məzmun inzibatçı təsdiqini gözləyir.

`TRY AZN` fürsəti yalnız Mərkəzi Bankın rəsmi TRY/AZN məlumatı olduqda `/valyuta/azn-try-cevirici` səhifəsinə yönləndirilir. Səhifədə interaktiv çevirmə, mənbə və yenilənmə tarixi göstərilir. Digər agent məzmunu `/guide/[slug]` ünvanında göstərilir. Dəyişikliklər, versiya tarixçəsi, geri qaytarma və indekslənmə qərarı `/admin` panelindədir; dərc edilən səhifələr sitemap-ə daxil edilir və IndexNow bildirişi göndərilir. Gündəlik texniki baxış 48 saat ərzindəki və 90 gündür yenilənməyən səhifələr üçün, GA4 artım siqnallarının olmamasına əsaslanan inzibatçı tövsiyəsi yaradır; bu siqnal trafikin tam hesabatı kimi qəbul edilməməlidir. Canlı Groq/Google axınını yoxlamaq üçün deployment mühitində etibarlı API açarları və xidmət hesabı sazlanmalıdır.

## AI provayderi

`lib/ai.ts` OpenAI və Anthropic provayderlərini `AI_PROVIDER` dəyərinə əsasən seçir. Model adı və API açarı mühit dəyişənlərindən oxunur. AI cavabı yalnız JSON kimi təhlil edilir və çağıranın verdiyi Zod sxemindən keçdikdən sonra istifadə olunur.

## Verilənlər bazası və Vercel

SQLite yerli inkişaf üçün sazlanıb. Vercel serverless fayl sistemi davamlı SQLite saxlanması üçün uyğun deyil. İstehsalda davamlı verilənlər bazası seçərkən `schema.prisma` datasource provayderini və `DATABASE_URL`-i PostgreSQL-ə keçirin, sonra miqrasiya yaradın.

Vercel layihəsində `DATABASE_URL`, AI dəyişənləri, `ADMIN_PASSWORD`, `CRON_SECRET` və mənbə URL-lərini mühit dəyişənləri kimi təyin edin. `NEXT_PUBLIC_SITE_URL`-i canlı saytın HTTPS ünvanına uyğunlaşdırın.

## AI söhbət köməkçisi

Söhbət paneli hər səhifənin sağ aşağı küncündə açılır. `GROQ_API_KEY` və `GROQ_MODEL` yalnız serverdə oxunur; Groq-un OpenAI uyğun streaming API-si `lib/ai.ts` vasitəsilə çağırılır. Söhbət xidməti konteksti yalnız `ContentItem`, dərc olunmuş `Question` və `ExamEvent` qeydlərindən qurur, SQLite FTS5 ilə ən uyğun beş nəticəni axtarır və cavabın sonunda həmin səhifələrə daxili keçid göstərir.

Sorğu 2 000 simvolla məhdudlaşır; IP başına dəqiqədə 5, gündə 30 mesaj qəbul edilir. Həddən artıq Groq sorğusu qısa eksponensial gözləmə ilə təkrar edilir. Şəxsi məlumat daxil etməmək üçün söhbət pəncərəsində xəbərdarlıq var; `ChatLog` sualındakı e-poçt, telefon, FIN kodu və şifrə nümunələri qeydə alınmazdan əvvəl gizlədilir. Xam IP söhbət jurnalına yazılmır; limit cədvəlində yalnız HMAC xülasəsi saxlanılır. `/admin` səhifəsində assistentin cavab tapa bilmədiyi suallar “Məzmun boşluqları” siyahısında mövzu siqnalı kimi görünür. Gələcəkdə bələdçi və tarif modelləri əlavə ediləndə həmin məzmun `lib/chat-search.ts` indeksləmə siyahısına daxil edilməlidir.

## Məlumatın yoxlanması

Məzmun çıxarma axını yalnız `CONTENT_SOURCE_URLS` daxilində göstərilən səhifələri oxuyur. AI tərəfindən verilən hər dəyər Zod ilə yoxlanır; aşağı riskli yeniliklər avtomatik yayımlanır, yüksək riskli yeniliklər inzibatçı qərarınadək gözləyir. AI sualları avtomatik dərc edilmir və imtahan tarixləri rəsmi mənbə göstərilmədən yaradılmır.
