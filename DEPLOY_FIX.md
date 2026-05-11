# Qalvero Vercel Deploy Fix

المشكلة كانت غالبًا في `package-lock.json` لأنه كان يحتوي على روابط tarball داخلية من بيئة غير عامة:
`packages.applied-caas-gateway1.internal.api.openai.org`

Vercel لا يستطيع الوصول لهذه الروابط، فيفشل `npm install` أو يعلق برسالة مثل:
`npm error Exit handler never called!`

التعديلات:
- تحويل كل روابط package-lock إلى `https://registry.npmjs.org/`
- ضبط `vercel.json` ليستخدم `npm ci --no-audit --no-fund`
- إضافة `registry=https://registry.npmjs.org/` في `.npmrc`
- إضافة `engine-strict=false`
- توحيد version في `package-lock.json` مع `package.json`

تم اختبار:
- `npm ci --no-audit --no-fund`
- `npm run build`

والـ build نجح.
