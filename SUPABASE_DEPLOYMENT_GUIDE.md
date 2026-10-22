# دليل نشر وربط نظام Payroll ERP على Supabase Free مجاناً 100% 🚀

هذا الدليل يوضح لك بالخطوات الدقيقة والبسيطة كيفية نقل وربط النظام السحابي بالكامل على **Supabase Free** مع الحفاظ على كافة بيانات شركتكم الحالية.

---

## 📁 الملفات التي تم إعدادها وتجهيزها في مشروعك:
1. **[`supabase/schema.sql`](file:///e:/ERP/supabase/schema.sql):** كود إنشاء كافة جداول النظام (15 جدول) وقواعد البيانات ومخزن الصور على Supabase PostgreSQL.
2. **[`supabase/data_export.sql`](file:///e:/ERP/supabase/data_export.sql):** ملف يحتوي على كافة بيانات شركتكم المسجلة حالياً (699 سجل: عمال، بصمات، مرتبات، سلف، وخزائن) جاهزة للاستيراد الفوري.
3. **[`scripts/migrate-to-supabase.js`](file:///e:/ERP/scripts/migrate-to-supabase.js):** أداة لنقل ومزامنة البيانات من SQLite إلى Supabase مباشرة بضغطة زر واحدة.
4. **[`server/supabase.js`](file:///e:/ERP/server/supabase.js):** كود الربط السحابي ومكتبة تخزين صور الفواتير والإيصالات.
5. **[`render.yaml`](file:///e:/ERP/render.yaml) و [`vercel.json`](file:///e:/ERP/vercel.json):** إعدادات النشر السحابي المجاني للبرنامج.

---

## 🛠️ خطوات التشغيل خطوة بخطوة:

### الخطوة 1: إنشاء مشروع مجاني على Supabase
1. ادخل على موقع [https://supabase.com](https://supabase.com) واضغط **Start your project** (يمكنك الدخول بحساب GitHub أو الإيميل).
2. اضغط على زر **New Project**.
3. املأ البيانات:
   * **Name:** اسم مشروعكم (مثال: `company-erp`).
   * **Database Password:** اكتب كلمة مرور قوية لقاعدة البيانات **واحفظها جيداً**.
   * **Region:** اختر أقرب سيرفر لمنطقتنا (مثلاً: `Central EU - Frankfurt` لأفضل وأسرع استجابة في مصر والشرق الأوسط).
   * **Pricing Plan:** تأكد من اختيار **Free Tier ($0/month)**.
4. اضغط **Create new project** وانتظر دقيقتين حتى يكتمل التجهيز.

---

### الخطوة 2: إنشاء الجداول على Supabase بضغطة زر
1. من القائمة الجانبية اليسرى في Supabase، اضغط على أيقونة **SQL Editor** (علامة `>_`).
2. اضغط على **+ New query**.
3. افتح ملف **[`supabase/schema.sql`](file:///e:/ERP/supabase/schema.sql)** الموجود في مشروعك، وانسخ كل ما بداخله بالكامل.
4. الصقه في شاشة الـ SQL Editor في Supabase، ثم اضغط على زر **RUN** الأخضر في الأسفل.
5. ستظهر لك رسالة: `Success. No rows returned` (تم إنشاء الـ 15 جدول ومخزن الصور بنجاح!).

---

### الخطوة 3: نقل بيانات شركتكم الحالية (699 سجل) إلى Supabase
يمكنك الاختيار بين طريقتين:

#### الطريقة الأولى (الأسهل بدون أوامر):
1. في نفس شاشة **SQL Editor** في Supabase، اضغط **+ New query**.
2. افتح ملف **[`supabase/data_export.sql`](file:///e:/ERP/supabase/data_export.sql)**، وانسخ كل محتواه.
3. الصقه في شاشة الـ SQL Editor، واضغط **RUN**.
4. فوراً، ستنتقل كافة بيانات العمال والسائقين والحضور ومسيرات الرواتب السابقة إلى Supabase.

#### الطريقة الثانية (عبر سكريبت النقل التلقائي في جهازك):
1. من لوحة تحكم Supabase، اذهب إلى: **Project Settings** (أيقونة الترس ⚙️) -> **Database**.
2. انزل إلى قسم **Connection string**، واختر تبويب **URI** (Session mode - port 6543).
3. انسخ الرابط، واستبدل كلمة `[YOUR-PASSWORD]` بكلمة مرور قاعدة البيانات التي كتبتها في الخطوة 1.
4. في شاشة PowerShell في مجلد المشروع، شغّل الأمر التالي:
   ```powershell
   node scripts/migrate-to-supabase.js "ضع_الرابط_المنسوخ_هنا"
   ```
5. سيقوم السكريبت بنقل كافة السجلات من جهازك إلى السحابة مع إظهار تقرير تأكيد كامل.

---

### الخطوة 4: التأكد من مخزن الصور والمستندات (Storage)
* تم إنشاء مخزن صور باسم **`receipts`** تلقائياً عبر ملف الـ Schema.
* يمكنك التأكد منه بالدخول على قسم **Storage** من القائمة اليسرى لـ Supabase للتأكد من وجود مجلد `receipts`.
* صور إيصالات الخزينة وفواتير المشتريات ستُحفظ في هذا المخزن بروابط دائمة ومحمية.

---

### الخطوة 5: ربط السيرفر والواجهة على استضافة مجانية (Render أو Vercel)
لتشغيل واجهة البرنامج وسيرفر الويب 24 ساعة مجاناً:

1. **ارفع كود المشروع على مستودع GitHub خاص بك (Private Repository).**
2. **سجل في منصة [Render.com](https://render.com) (مجاناً 100%):**
   * اضغط **New** -> **Web Service**.
   * اربط حساب GitHub واختر مستودع المشروع.
   * في حقل **Build Command** اكتب:
     ```bash
     npm install && npm run build
     ```
   * في حقل **Start Command** اكتب:
     ```bash
     node server/index.js
     ```
   * في قسم **Environment Variables (المتغيرات)**، أضف:
     * `DATABASE_URL`: رابط الاتصال الخاص بقاعدة بيانات Supabase.
     * `SUPABASE_URL`: رابط المشروع (مثل `https://xxxx.supabase.co`).
     * `SUPABASE_ANON_KEY`: المفتاح العام (Anon key) من إعدادات Supabase API.
     * `NODE_ENV`: `production`
3. اضغط **Deploy Web Service**.

---

### 🎯 النتيجة النهائية:
* أصبح لديك نظام ERP سحابي متكامل يملكه شركتكم 100%.
* قاعدة البيانات مشفرة وتعمل على أقوى خوادم PostgreSQL العالمية عبر **Supabase**.
* متاح للمدير والعمال والمخازن في أي وقت ومن أي مكان في العالم برابط سحابي سريع وبتكلفة **0.00 جنيه شهرياً للأبد**.
