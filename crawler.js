 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/crawler.js b/crawler.js
index 68247b8606ef69b141f30e2eee5d11dc8fd85d5c..b4925e95aaec36db609422098ac14132677c9f94 100644
--- a/crawler.js
+++ b/crawler.js
@@ -1,124 +1,138 @@
 const https = require("https");
 const http = require("http");
 
 const KEYS = {
   bizinfo: process.env.BIZINFO_KEY || "",
   kstartup: process.env.KSTARTUP_KEY || "",
   smes: process.env.SMES_KEY || "",
   g2b: process.env.G2B_KEY || "",
   gemini: process.env.GEMINI_KEY || "",
   seoulOpenApi: process.env.SEOUL_OPENAPI_KEY || "",
   bokjiro: process.env.BOKJIRO_KEY || "",
 };
 
 const KEYWORDS = (process.env.KEYWORDS || [
   "심리상담", "심리지원", "심리안정", "마음건강", "마음투자",
   "정신건강", "정신건강복지", "정신건강 바우처",
   "상담 바우처", "심리상담 바우처", "전자바우처",
   "아동 심리", "청소년 심리", "청소년 상담", "청년 마음건강",
   "성인 심리", "발달장애 부모상담", "정서발달",
   "상담 위탁", "상담 운영기관", "심리상담 제공기관", "수행기관 모집",
   "위탁운영", "지정기관", "심리상담 지정",
   "지역사회서비스", "사회서비스 투자사업",
   "EAP", "근로자지원프로그램", "직장인 심리상담",
   "트라우마", "자살예방", "생명존중",
   "소상공인 지원", "소규모 사업장 지원", "영세사업자 지원",
-  "창업지원", "사회적기업", "사회적경제",
+  "창업지원", "여성창업", "여성기업", "사회적기업", "사회적경제",
   "고용안정", "일자리 창출", "인건비 지원",
   "진로상담", "학교상담", "Wee센터",
 ].join(","))
   .split(",")
   .map(s => s.trim())
   .filter(Boolean);
 
 const EXCLUDE_PATTERNS_STRICT = [
   "수강생 모집",
   "교육생 모집",
   "채용공고",
   "인턴 채용",
   "신입 채용",
   "경력 채용",
   "융자",
   "대출",
   "의료기기",
   "의약품",
   "건설공사",
   "토목공사",
   "도로공사",
   "시설보수",
 ];
 
 const NEGATIVE_PATTERNS = [
   "참가자 모집",
   "물품",
   "납품",
   "단순 구매",
   "단순 조달",
   "IT 구축",
   "소프트웨어 개발",
   "플랫폼 개발",
   "AI 구축",
   "AI 개발",
 ];
 
 const POSITIVE_PATTERNS = [
   "심리상담", "심리지원", "심리안정", "마음건강", "마음투자",
   "정신건강", "바우처", "전자바우처",
   "상담 제공기관", "수행기관", "운영기관", "위탁",
   "지정기관", "지역사회서비스",
   "아동 심리", "청소년 상담", "청년 마음",
   "발달장애", "정서발달", "부모상담",
   "트라우마", "자살예방", "생명존중",
   "eap", "근로자지원", "직장인 상담",
   "사회적기업", "사회적경제",
   "인건비", "운영비", "보조금",
   "소상공인", "영세", "소규모",
+  "여성기업", "여성창업", "여성기업확인",
   "진로상담", "학교상담", "wee",
-  "강남구", "강남",
+  "강남구", "강남", "서울", "전국", "비대면", "온라인",
 ];
 
-const GANGNAM_INCLUDE = ["강남", "강남구", "서울", "수도권", "전국", "온라인", "비대면", "서초", "송파"];
+const LOCATION_INCLUDE = ["서울", "전국", "비대면", "온라인"];
 const REGION_EXCLUDE = [
   "부산","대구","인천","광주","대전","울산","세종",
   "경기","강원","충북","충남","전북","전남","경북","경남","제주",
   "충청","전라","경상","호남","영남","강원도"
 ];
 
+const FOCUS_BUSINESS_KEYWORDS = [
+  "창업지원", "사업화", "초기창업", "예비창업", "여성기업", "여성창업", "여성기업확인", "여성전용"
+];
+
+const COMPANY_PROFILE = {
+  officeRegion: process.env.COMPANY_OFFICE_REGION || "서울",
+  foundedDate: process.env.COMPANY_FOUNDED_DATE || "2026-01-01",
+  womenFounded: (process.env.COMPANY_WOMEN_FOUNDED || "true").toLowerCase() === "true",
+};
+
 const GEMINI_SEARCH_QUERIES = [
   "2026 심리상담 바우처 제공기관 모집",
   "2026 마음투자 지원사업 제공기관 등록",
   "2026 지역사회서비스 투자사업 심리지원 서울",
   "2026 청소년 심리상담 위탁기관 모집",
   "2026 청년 마음건강 지원사업 상담기관",
   "2026 아동청소년 정서발달 서비스 제공기관",
   "2026 EAP 근로자지원프로그램 상담기관 모집",
   "2026 자살예방 심리상담 운영기관 모집 서울",
   "2026 소상공인 심리상담센터 정부지원 보조금",
   "2026 강남구 심리상담 위탁운영 공고",
   "2026 사회서비스 전자바우처 심리상담 신규 제공기관",
   "2026 서울시 트라우마 심리지원 수행기관 모집",
+  "2026 서울 여성기업 창업지원 심리상담센터",
+  "2026 여성창업 지원사업 서울 비대면 상담서비스",
+  "2026 전국 여성기업 확인제도 연계 창업지원 공고",
 ];
 
 const logs = [];
 function log(msg) {
   console.log(msg);
   logs.push(msg);
 }
 
 function fetchJson(url) {
   return new Promise((resolve, reject) => {
     const lib = url.startsWith("https") ? https : http;
     lib.get(url, { headers: { "User-Agent": "GovCrawler/1.0" } }, (res) => {
       let data = "";
       res.on("data", chunk => data += chunk);
       res.on("end", () => {
         try {
           resolve(JSON.parse(data));
         } catch (e) {
           reject(new Error("JSON parse error: " + data.substring(0, 200)));
         }
       });
     }).on("error", reject);
   });
 }
 
@@ -153,50 +167,56 @@ function fetchPost(url, body) {
     req.on("error", reject);
     req.write(bodyStr);
     req.end();
   });
 }
 
 function sleep(ms) {
   return new Promise(r => setTimeout(r, ms));
 }
 
 function normalizeDate(str) {
   if (!str) return "";
   const clean = str.replace(/\./g, "-").replace(/\//g, "-").trim();
   const m = clean.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
   if (!m) return "";
   return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
 }
 
 function parseDeadline(str) {
   if (!str) return null;
   const m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
   if (!m) return null;
   return new Date(+m[1], +m[2] - 1, +m[3]);
 }
 
+function yearsSince(dateStr, 기준일) {
+  const start = parseDeadline(dateStr);
+  if (!start || !기준일) return null;
+  return (기준일.getTime() - start.getTime()) / 31557600000;
+}
+
 function isExpired(str) {
   const d = parseDeadline(str);
   if (!d) return false;
   const now = new Date();
   now.setHours(0, 0, 0, 0);
   return d.getTime() < now.getTime();
 }
 
 function dDay(str) {
   const d = parseDeadline(str);
   if (!d) return null;
   return Math.ceil((d.getTime() - Date.now()) / 86400000);
 }
 
 function formatG2bDate(d) {
   return d.getFullYear()
     + String(d.getMonth() + 1).padStart(2, "0")
     + String(d.getDate()).padStart(2, "0")
     + "0000";
 }
 
 function compactText(...parts) {
   return parts
     .filter(Boolean)
     .join(" ")
@@ -548,59 +568,61 @@ async function fetchSocialServicePortal() {
         target: (it.trgtNm || "").trim(),
         deadline: normalizeDate(it.endDe || ""),
         summary: (it.cn || it.svcCn || "").trim().substring(0, 120),
         url: it.detailUrl || it.link || "https://www.socialservice.or.kr",
         source: "socialservice",
         agency: (it.insttNm || "사회서비스포털").trim()
       })).filter(it => it.name.length >= 5);
 
       results = results.concat(matched);
     } catch (e) {
       log(`[socialservice] ${term} ERROR: ${e.message}`);
     }
     await sleep(800);
   }
 
   log(`[socialservice] 총 ${results.length}건`);
   return results;
 }
 
 async function fetchGemini(query) {
   const prompt = `
 너는 한국 정부지원사업 / 심리상담 위탁운영 / 바우처 제공기관 모집 / 사회서비스 투자사업 리서처다.
 
 검색어: ${query}
 
-우리는 서울 강남구에 위치한 심리상담센터(개인사업자 + 법인 병행)다. 다음 기회를 찾고 있다.
+우리는 서울에 사무실이 있는 심리상담센터(개인사업자 + 법인 병행)다.
+2026년 1월 여성 창업(여성기업) 배경을 고려해 다음 기회를 찾고 있다.
 - 심리상담 바우처 제공기관 등록/모집 (마음투자, 전자바우처 등)
 - 심리상담 위탁운영, 지정기관, 수행기관 모집 공고
 - 지역사회서비스 투자사업 (아동·청소년 심리지원, 정서발달, 성인 심리지원 등)
 - 심리안정 지원, 트라우마 상담, 자살예방 상담 운영기관 모집
 - 인건비/운영비 보조금 지원사업 (소상공인, 사회적기업 등)
 - 진로상담, 학교상담 위탁기관 모집
 - EAP(근로자지원프로그램) 상담기관 등록
 - 창업/사업화 지원 (심리상담센터가 받을 수 있는 것)
+- 여성기업/여성창업 전용 지원사업
 
 반드시 아래 원칙을 지켜라.
 1. 실제 검색으로 확인된 공고만 포함
 2. 이미 마감된 공고 제외
 3. 채용공고/교육생 모집은 제외
 4. 사업명, 대상, 마감일, 기관, URL을 최대한 정확히 적기
 5. deadline은 YYYY-MM-DD
 6. deadline을 모르겠으면 2026-12-31
 7. url이 불명확하면 기관 공지사항 URL
 8. 결과가 없으면 빈 배열 []
 9. 최대 8개
 10. JSON 배열만 출력
 
 출력 형식:
 [
   {
     "name":"사업명",
     "target":"대상",
     "deadline":"YYYY-MM-DD",
     "summary":"짧은 요약",
     "url":"https://...",
     "source":"출처사이트",
     "agency":"기관"
   }
 ]
@@ -683,111 +705,154 @@ function parseGeminiResponse(apiResponse) {
       }
 
       if (!/^\d{4}-\d{2}-\d{2}$/.test(r.deadline)) {
         r.deadline = "2026-12-31";
       }
 
       return true;
     });
 }
 
 function isExplicitlyOtherRegionOnly(text) {
   for (const region of REGION_EXCLUDE) {
     const patterns = [
       new RegExp(region + ".{0,4}(한정|소재|지역|거주|기업|소기업|업체)"),
       new RegExp("^" + region)
     ];
     if (patterns.some(re => re.test(text))) return true;
   }
   return false;
 }
 
 function regionScore(text) {
   if (!text) return 0;
   if (isExplicitlyOtherRegionOnly(text)) return -4;
 
-  const hasAnyRegionKeyword = [...GANGNAM_INCLUDE, ...REGION_EXCLUDE].some(k => text.includes(k));
+  const hasAnyRegionKeyword = [...LOCATION_INCLUDE, ...REGION_EXCLUDE].some(k => text.includes(k));
   if (!hasAnyRegionKeyword) return 1;
 
-  if (text.includes("강남") || text.includes("강남구")) return 4;
-  if (GANGNAM_INCLUDE.some(k => text.includes(k))) return 2;
+  if (text.includes("서울")) return 4;
+  if (LOCATION_INCLUDE.some(k => text.includes(k))) return 3;
 
   return 0;
 }
 
+function hasPreferredLocation(text, source) {
+  if (source === "gangnam" || source === "seoul_openapi") return true;
+  if (LOCATION_INCLUDE.some(k => text.includes(k))) return true;
+  return false;
+}
+
+function isEligibleByCompanyProfile(text, deadline, profile) {
+  const refDate = parseDeadline(deadline) || new Date();
+  const foundedYears = yearsSince(profile.foundedDate, refDate);
+
+  if ((text.includes("여성기업") || text.includes("여성창업")) && !profile.womenFounded) {
+    return false;
+  }
+
+  const atMostMatch = text.match(/(창업|업력).{0,8}(\d+)\s*년\s*(이내|미만)/);
+  if (atMostMatch && foundedYears !== null) {
+    const limit = Number(atMostMatch[2]);
+    if (Number.isFinite(limit) && foundedYears > limit) return false;
+  }
+
+  const atLeastMatch = text.match(/(창업|업력).{0,8}(\d+)\s*년\s*이상/);
+  if (atLeastMatch && foundedYears !== null) {
+    const minYears = Number(atLeastMatch[2]);
+    if (Number.isFinite(minYears) && foundedYears < minYears) return false;
+  }
+
+  if (text.includes("서울") && text.includes("소재") && profile.officeRegion !== "서울") {
+    return false;
+  }
+
+  return true;
+}
+
 function computeScore(r) {
   const text = normalizeText(compactText(r.name, r.agency, r.target, r.summary));
   let score = 0;
 
   if (r.name && r.name.length >= 5) score += 1;
   if (!isExpired(r.deadline)) score += 1;
 
   if (EXCLUDE_PATTERNS_STRICT.some(p => text.includes(p.toLowerCase()))) {
     return -999;
   }
 
   for (const p of POSITIVE_PATTERNS) {
     if (text.includes(p.toLowerCase())) score += 2;
   }
 
   for (const n of NEGATIVE_PATTERNS) {
     if (text.includes(n.toLowerCase())) score -= 3;
   }
 
   if (r.source === "gangnam") score += 4;
   if (r.source === "seoul_openapi") score += 3;
   if (r.source === "socialservice") score += 3;
   if (r.source === "bokjiro_central") score += 3;
   if (r.source === "bokjiro_local") score += 3;
   if (r.source === "bizinfo") score += 2;
   if (r.source === "kstartup") score += 1;
   if (r.source === "smes") score += 1;
   if (r.source === "gemini") score += 1;
   if (r.source === "g2b") score += 0;
 
   score += regionScore(text);
 
   const counselingBoostWords = [
     "심리상담 바우처", "마음투자", "전자바우처 제공기관",
     "위탁운영", "수행기관 모집", "지정기관 모집",
     "심리안정 지원", "심리지원 서비스",
     "인건비 지원", "운영비 보조",
   ];
   for (const w of counselingBoostWords) {
     if (text.includes(w.toLowerCase())) score += 3;
   }
 
   if (text.includes("물품") && !text.includes("상담") && !text.includes("심리")) score -= 4;
   if (text.includes("납품") && !text.includes("서비스") && !text.includes("상담")) score -= 4;
+  if (FOCUS_BUSINESS_KEYWORDS.some(w => text.includes(w.toLowerCase()))) score += 4;
 
   return score;
 }
 
 function filterResults(results) {
   return results
     .filter(r => r && r.name && r.name.length >= 5)
     .filter(r => !isExpired(r.deadline))
+    .filter(r => {
+      const text = normalizeText(compactText(r.name, r.agency, r.target, r.summary));
+      if (isExplicitlyOtherRegionOnly(text)) return false;
+      return hasPreferredLocation(text, r.source);
+    })
+    .filter(r => {
+      const text = normalizeText(compactText(r.name, r.agency, r.target, r.summary));
+      return isEligibleByCompanyProfile(text, r.deadline, COMPANY_PROFILE);
+    })
     .map(r => ({ ...r, score: computeScore(r) }))
     .filter(r => r.score >= 2);
 }
 
 function deduplicateResults(results) {
   const seen = new Set();
   return results.filter(r => {
     const key = [
       (r.name || "").replace(/\s+/g, "").toLowerCase().substring(0, 40),
       (r.agency || "").replace(/\s+/g, "").toLowerCase().substring(0, 20),
       (r.deadline || "")
     ].join("|");
     if (seen.has(key)) return false;
     seen.add(key);
     return true;
   });
 }
 
 const SEEN_FILE = "seen.json";
 
 function loadSeen() {
   const fs = require("fs");
   try {
     if (fs.existsSync(SEEN_FILE)) {
       const data = JSON.parse(fs.readFileSync(SEEN_FILE, "utf-8"));
@@ -1013,50 +1078,51 @@ async function sendEmail(html, csv, date, count) {
   });
 
   await transporter.sendMail({
     from: `"심리상담센터 지원사업 크롤러" <${process.env.EMAIL_FROM}>`,
     to: process.env.EMAIL_TO,
     subject: `[심리상담 지원사업] ${date} 크롤링 결과 — ${count}건`,
     html,
     attachments: [{
       filename: `심리상담_지원사업_${date}.csv`,
       content: Buffer.from(csv, "utf-8"),
       contentType: "text/csv; charset=utf-8",
     }],
   });
 
   log(`이메일 전송 완료 → ${process.env.EMAIL_TO}`);
 }
 
 async function main() {
   if (!KEYS.bizinfo) {
     console.error("오류: BIZINFO_KEY 환경변수가 없습니다.");
     process.exit(1);
   }
 
   const today = new Date().toISOString().slice(0, 10);
   log(`=== 심리상담센터 지원사업 크롤링 시작: ${today} ===`);
+  log(`회사 프로필: ${COMPANY_PROFILE.officeRegion} 사무실 / 설립 ${COMPANY_PROFILE.foundedDate} / 여성창업 ${COMPANY_PROFILE.womenFounded ? "Y" : "N"}`);
 
   let allResults = [];
   let errorCount = 0;
 
   for (const kw of KEYWORDS) {
     if (KEYS.kstartup) {
       try {
         const r = await fetchKStartup(kw);
         allResults = allResults.concat(r);
         log(`[k-startup] ${kw}: ${r.length}건`);
       } catch (e) { errorCount++; log(`[k-startup] ${kw} ERROR: ${e.message}`); }
       await sleep(1200);
     }
 
     if (KEYS.smes) {
       try {
         const r = await fetchSmes(kw);
         allResults = allResults.concat(r);
         log(`[smes] ${kw}: ${r.length}건`);
       } catch (e) { errorCount++; log(`[smes] ${kw} ERROR: ${e.message}`); }
       await sleep(1200);
     }
 
     if (KEYS.g2b) {
       try {
 
EOF
)
