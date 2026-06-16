# ⚙️ Raft Consensus Protocol Coordinator

> TypeScript + Node.js + Express — محاكاة خوارزمية Raft لانتخاب القائد وتزامن البيانات عبر cluster موزّع

---

## 📌 نظرة عامة

هذا المشروع يُحاكي بيئة **Decentralized Election Voting Vault** حقيقية، حيث يتم تسجيل الأصوات الانتخابية بشكل متطابق عبر 3 سيرفرات موزّعة باستخدام **Raft Consensus Algorithm**، مما يمنع تعارض البيانات (Split-Brain) في حالات انقطاع الشبكة.

---

## 🛠️ التقنيات المستخدمة

| التقنية | الدور |
|---|---|
| TypeScript | لغة البرمجة الرئيسية |
| Node.js | بيئة التشغيل |
| Express.js | خادم الويب والـ API |
| tsx | تشغيل TypeScript مباشرة بدون compile |

---

## 🧠 المفاهيم المُطبَّقة

### 1. Node States — حالات الـ Node
كل node في الـ cluster يمر بـ 3 حالات:

| الحالة | المعنى |
|---|---|
| `follower` | الحالة الافتراضية — ينتظر heartbeat من الـ Leader |
| `candidate` | انتهت مهلة الانتظار — بدأ يطلب أصوات الانتخاب |
| `leader` | فاز بالأغلبية — يرسل heartbeat ويستقبل البيانات |

### 2. Leader Election — انتخاب القائد
إذا لم يصل heartbeat خلال مهلة عشوائية (150-300ms)، يبدأ الـ follower انتخاباً جديداً:
```
Follower → (timeout) → Candidate → (يجمع أصوات) → Leader
```

### 3. Quorum — قانون الأغلبية
الـ Leader لا يُثبَّت إلا بموافقة **N/2 + 1** من الـ nodes:
```
3 nodes → Quorum = 2
```

### 4. Log Replication — تزامن البيانات
الـ Leader يستقبل البيانات ويوزعها على الـ followers، وتُحفظ فقط عند موافقة الأغلبية، وإلا تُلغى (Rollback).

### 5. Dead-Leader Recovery
عند crash الـ Leader، يكتشف الـ followers غياب الـ heartbeat ويبدأون انتخاباً جديداً تلقائياً بـ Term أعلى.

---

## 📂 هيكل الملفات

```
Raft/
├── src/
│   └── services/
│       └── RaftOrchestrator.ts   ← كل منطق Raft + Express Server
├── package.json
├── tsconfig.json
└── README.md
```

---

## ⚙️ المتطلبات

- Node.js >= 18
- npm

---

## 🚀 طريقة التشغيل

### الخطوة 1 — استنساخ المشروع

```bash
git clone https://github.com/omamaMhd/Raft_Consensus-Expert.git
cd Raft_Consensus-Expert
```

### الخطوة 2 — تثبيت الـ dependencies

```bash
npm install
```

### الخطوة 3 — تشغيل الـ Server

```bash
npx tsx src/services/RaftOrchestrator.ts
```

يجب أن ترى في الترمنال:
```
🚀 [SERVER READY] Raft Visual Sandbox live at http://127.0.0.1:8080
⚡ [ELECTION] Raft-2 started election for Term [1].
👑 [LEADER] Raft-2 won the election for Term [1].
```

### الخطوة 4 — افتح المتصفح

```
http://127.0.0.1:8080
```

---

## 🧪 سيناريوهات الاختبار

### سيناريو 1 — مشاهدة الـ Cluster حياً
افتح `http://127.0.0.1:8080` وشاهد:
- أي node أصبح **LEADER** (أخضر)
- الـ Term الحالي لكل node
- سجل الأصوات المُتزامنة

---

### سيناريو 2 — تزامن صوت انتخابي (Quorum Sync) 🗳️
1. اضغط زر **Simulate Precinct Ballot Vote**
2. ⚠️قم بعمل **تحديث (Refresh)** للمتصفح فوراً لمشاهدة انعكاس البيانات الحية.
**ما يحدث:**
```
Client يرسل صوت للـ Leader
      ↓
Leader يضيفه لـ log الخاص به
      ↓
يرسله لـ Raft-2 و Raft-3
      ↓
2 من 3 وافقوا = Quorum ✅
      ↓
الصوت يُثبَّت في الـ log على الجميع (يظهر بوضوح بعد الـ Refresh)
```

---

### سيناريو 3 — إسقاط الـ Leader وإعادة الانتخاب 💥
1. اضغط زر **Crash Active Leader Node**
2. ⚠️قم بعمل **تحديث سريع (Refresh)** للمتصفح لتشاهد كيف انتفضت الشبكة تلقائياً ونُصِّبَ الحاكم الجديد.
**في الترمنال تشوف:**
```
💥 [CRASH] Raft-2 disconnected!
⚡ [ELECTION] Raft-1 started election for Term [2].
👑 [LEADER] Raft-1 won the election for Term [2].
```

---

## 🔑 منطق الكود الأساسي

### Election Timeout العشوائي
```typescript
const randomizedTimeout = Math.floor(Math.random() * 150) + 150;
// بين 150ms و 300ms — يمنع تعارض الانتخابات
```

### Quorum Formula
```typescript
const totalNodes = this.cluster.length + 1; // N
const quorum = Math.floor(totalNodes / 2) + 1; // N/2 + 1
```

### Vote Validation
```typescript
if (candTerm >= localLastLogTerm && candLastLogIndex >= localLastLogIndex) {
    this.votedFor = candidateId;
    return true;
}
```

### Log Rollback عند فشل الـ Quorum
```typescript
if (replicationSuccessCount >= quorum) {
    return true; // commit
} else {
    this.log.pop(); // rollback
    return false;
}
```

---

## 🌐 الـ API Endpoints

| Method | Route | الوظيفة |
|---|---|---|
| GET | `/` | عرض الـ Cluster Dashboard |
| POST | `/vote` | إرسال صوت انتخابي للـ Leader |
| POST | `/crash` | إسقاط الـ Leader الحالي |

---

## ✅ Task Checklist

| المطلوب | الحالة |
|---|---|
| 3-node cluster (Follower / Candidate / Leader) | ✅ |
| Randomized Election Timeout | ✅ |
| Leader Heartbeat Broadcasting | ✅ |
| Vote Request Consensus Validation | ✅ |
| Quorum Law N/2 + 1 | ✅ |
| Log Replication على الأغلبية | ✅ |
| Rollback عند فشل الـ Quorum | ✅ |
| Crash & Automatic Re-election | ✅ |
| Live Dashboard | ✅ |
