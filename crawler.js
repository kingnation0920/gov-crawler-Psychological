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
  "창업지원", "사회적기업", "사회적경제",
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
  "진로상담", "학교상담", "wee",
  "강남구", "강남",
];

const GANGNAM_INCLUDE = ["강남", "강남구", "서울", "수도권", "전국", "온라인", "비대면", "서초", "송파"];
const REGION_EXCLUDE = [
  "부산","대구","인천","광주","대전","울산","세종",
  "경기","강원","충북","충남","전북","전남","경북","경남","제주",
  "충청","전라","경상","호남","영남","강원도"
];

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

function fetchPost(url, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
        "User-Agent": "GovCrawler/1.0"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("JSON parse: " + data.substring(0, 200)));
        }
      });
    });

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
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

async function fetchBizinfoAll() {
  const url =
    "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do"
    + "?crtfcKey=" + encodeURIComponent(KEYS.bizinfo)
    + "&dataType=json"
    + "&numOfRows=500&pageNo=1";

  const data = await fetchJson(url);

  let list = [];
  if (data.jsonArray) list = data.jsonArray;
  else if (data.items) list = data.items;
  else if (data.response?.body?.items) list = data.response.body.items;
  else if (data.data) list = data.data;
  else if (Array.isArray(data)) list = data;
  else {
    for (const k of Object.keys(data)) {
      if (Array.isArray(data[k]) && data[k].length > 0) {
        list = data[k];
        break;
      }
    }
  }

  return list.map(it => ({
    name: (it.pblancNm || it.title || "").trim(),
    target: (it.trgetNm || "").trim(),
    deadline: normalizeDate(it.reqstEndDe || it.endDate || ""),
    summary: (it.bsnsSumryCn || it.description || "").trim().substring(0, 120),
    url: it.pblancUrl || it.link || (it.pblancId ? "https://www.bizinfo.go.kr/see/seea/selectSEEA140Detail.do?pblancId=" + it.pblancId : ""),
    source: "bizinfo",
    agency: (it.jrsdInsttNm || it.author || "").trim()
  })).filter(it => it.name.length >= 5);
}

async function fetchKStartup(keyword) {
  const url =
    "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01"
    + "?ServiceKey=" + KEYS.kstartup
    + "&page=1&perPage=100&returnType=json";

  const data = await fetchJson(url);
  let list = [];

  if (data.data && Array.isArray(data.data)) list = data.data;
  else if (data.items) {
    const raw = data.items;
    list = Array.isArray(raw) ? raw : (raw.item ? (Array.isArray(raw.item) ? raw.item : [raw.item]) : []);
  }

  const kwLower = keyword.toLowerCase();

  return list
    .filter(it => {
      const text = normalizeText(compactText(it.biz_pbanc_nm, it.pbanc_ctnt, it.aply_trgt, it.sprv_inst));
      return text.includes(kwLower);
    })
    .map(it => {
      let detailUrl = it.detl_pg_url || "";
      if (detailUrl && !detailUrl.startsWith("http")) detailUrl = "https://" + detailUrl;

      return {
        name: (it.biz_pbanc_nm || "").trim(),
        target: (it.aply_trgt || "").trim(),
        deadline: normalizeDate(it.pbanc_rcpt_end_dt || ""),
        summary: (it.pbanc_ctnt || "").trim().substring(0, 120),
        url: detailUrl || "https://www.k-startup.go.kr",
        source: "kstartup",
        agency: (it.sprv_inst || "창업진흥원").trim()
      };
    });
}

async function fetchSmes(keyword) {
  const url =
    "https://www.smes.go.kr/fnct/apiReqst/extPblancInfo"
    + "?authKey=" + encodeURIComponent(KEYS.smes)
    + "&pageNo=1&dataRows=30&type=json";

  const data = await fetchJson(url);
  let list = [];

  if (data.response?.body?.items) {
    list = data.response.body.items;
    if (!Array.isArray(list)) {
      list = list.item ? (Array.isArray(list.item) ? list.item : [list.item]) : [];
    }
  } else if (data.items) {
    list = data.items;
  } else if (data.data) {
    list = data.data;
  }

  const kw = keyword.toLowerCase();

  return list
    .filter(it => {
      const text = normalizeText(compactText(it.pblancNm, it.title, it.bsnsSumryCn, it.trgetNm, it.jrsdInsttNm));
      return text.includes(kw);
    })
    .map(it => ({
      name: (it.pblancNm || it.title || "").trim(),
      target: (it.trgetNm || "").trim(),
      deadline: normalizeDate(it.reqstEndDe || it.endDe || ""),
      summary: (it.bsnsSumryCn || "").trim().substring(0, 120),
      url: it.pblancUrl || it.detailUrl || "https://www.smes.go.kr",
      source: "smes",
      agency: (it.jrsdInsttNm || "").trim()
    }));
}

async function fetchG2b(keyword) {
  const now = new Date();
  const bgnDt = formatG2bDate(new Date(now.getTime() - 30 * 86400000));
  const endDt = formatG2bDate(new Date(now.getTime() + 90 * 86400000));

  const url =
    "https://apis.data.go.kr/1230000/BidPublicInfoService/getBidPblancListInfoServc"
    + "?ServiceKey=" + encodeURIComponent(KEYS.g2b)
    + "&inqryDiv=1&type=json"
    + "&inqryBgnDt=" + bgnDt
    + "&inqryEndDt=" + endDt
    + "&numOfRows=100&pageNo=1";

  const data = await fetchJson(url);

  let list = [];
  if (data.response?.body?.items) {
    list = data.response.body.items;
    if (!Array.isArray(list)) {
      list = list.item ? (Array.isArray(list.item) ? list.item : [list.item]) : [];
    }
  }

  const kw = keyword.toLowerCase();

  return list
    .filter(it => {
      const text = normalizeText(compactText(
        it.bidNtceNm,
        it.prdctClsfcNoNm,
        it.ntceInsttNm,
        it.ntceInsttOfclNm,
        it.dminsttNm
      ));
      return text.includes(kw);
    })
    .map(it => ({
      name: (it.bidNtceNm || it.prdctClsfcNoNm || "").trim(),
      target: (it.ntceInsttNm || "").trim(),
      deadline: normalizeDate(it.bidClseDt || it.bidBeginDt || ""),
      summary: (it.ntceInsttOfclNm || "").trim().substring(0, 120),
      url: it.bidNtceDtlUrl || (it.bidNtceNo ? "https://www.g2b.go.kr:8101/ep/invitation/publish/bidInfoDtl.do?bidno=" + it.bidNtceNo : ""),
      source: "g2b",
      agency: (it.dminsttNm || it.ntceInsttNm || "").trim()
    }));
}

async function fetchSeoulOpenApi() {
  if (!KEYS.seoulOpenApi) return [];

  let results = [];

  try {
    const url = `http://openapi.seoul.go.kr:8088/${KEYS.seoulOpenApi}/json/GovSupportBizInfo/1/100/`;
    const data = await fetchJson(url);

    let list = [];
    const root = data.GovSupportBizInfo;
    if (root?.row) list = root.row;

    const matched = list
      .filter(it => {
        const text = normalizeText(compactText(it.BIZ_NM, it.BIZ_CN, it.BASS_APLY_QUAL, it.CHRG_INST_NM));
        return KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
      })
      .map(it => ({
        name: (it.BIZ_NM || "").trim(),
        target: (it.BASS_APLY_QUAL || "").trim(),
        deadline: normalizeDate(it.APLY_END_DE || ""),
        summary: (it.BIZ_CN || "").trim().substring(0, 120),
        url: it.DETAIL_URL || it.APLY_SITE_ADDR || "https://www.seoul.go.kr",
        source: "seoul_openapi",
        agency: (it.CHRG_INST_NM || "서울시").trim()
      }));

    results = results.concat(matched);
    log(`[seoul_openapi] 서울시 지원사업: ${matched.length}건`);
  } catch (e) {
    log(`[seoul_openapi] ERROR: ${e.message}`);
  }

  return results;
}

async function fetchBokjiro() {
  if (!KEYS.bokjiro) return [];

  const endpoints = [
    {
      label: "중앙부처 복지서비스",
      url: "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist"
        + "?ServiceKey=" + encodeURIComponent(KEYS.bokjiro)
        + "&pageNo=1&numOfRows=100&type=json",
      source: "bokjiro_central",
    },
    {
      label: "지자체 복지서비스",
      url: "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist"
        + "?ServiceKey=" + encodeURIComponent(KEYS.bokjiro)
        + "&pageNo=1&numOfRows=100&type=json"
        + "&lifeArray=&charTrgterArray=&trgterIndvdlArray=&desireArray=020",
      source: "bokjiro_local",
    },
  ];

  let results = [];

  for (const ep of endpoints) {
    try {
      const data = await fetchJson(ep.url);

      let list = [];
      if (data.response?.body?.items?.item) {
        const raw = data.response.body.items.item;
        list = Array.isArray(raw) ? raw : [raw];
      } else if (data.wantedList) {
        list = data.wantedList;
      } else if (data.data) {
        list = Array.isArray(data.data) ? data.data : [];
      } else if (data.response?.body?.items) {
        const raw = data.response.body.items;
        list = Array.isArray(raw) ? raw : [];
      }

      const matched = list
        .filter(it => {
          const text = normalizeText(compactText(
            it.servNm, it.servDgst, it.lifeNmArray, it.intrsThemaNmArray,
            it.trgterIndvdlNmArray, it.bizChrNm, it.ctpvNm, it.sggNm
          ));
          return KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
        })
        .map(it => {
          const servId = it.servId || it.wlfareInfoId || "";
          const detailUrl = servId
            ? `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=${servId}`
            : "https://www.bokjiro.go.kr";

          return {
            name: (it.servNm || "").trim(),
            target: (it.trgterIndvdlNmArray || it.lifeNmArray || "").trim(),
            deadline: normalizeDate(it.aplyEndDt || it.endDt || ""),
            summary: (it.servDgst || "").trim().substring(0, 120),
            url: it.servDtlLink || detailUrl,
            source: ep.source,
            agency: (it.bizChrNm || it.ctpvNm || "복지로").trim()
          };
        })
        .filter(it => it.name.length >= 5);

      results = results.concat(matched);
      log(`[bokjiro] ${ep.label}: ${matched.length}건`);
    } catch (e) {
      log(`[bokjiro] ${ep.label} ERROR: ${e.message}`);
    }
    await sleep(1000);
  }

  return results;
}

async function fetchGangnamNotices() {
  const searchTerms = ["심리상담", "심리지원", "마음건강", "위탁운영", "바우처", "상담기관"];
  let results = [];

  for (const term of searchTerms) {
    try {
      const url = `https://www.gangnam.go.kr/portal/bbs/search.do?searchText=${encodeURIComponent(term)}&pageIndex=1&pageSize=10&category=notice&output=json`;
      const data = await fetchJson(url);

      let list = [];
      if (data.resultList) list = data.resultList;
      else if (data.list) list = data.list;
      else if (Array.isArray(data)) list = data;

      const matched = list
        .filter(it => {
          const title = (it.title || it.nttSj || "").trim();
          return title.length >= 5;
        })
        .map(it => {
          const title = (it.title || it.nttSj || "").trim();
          const bbsId = it.bbsId || it.bbs_id || "";
          const nttId = it.nttId || it.ntt_id || it.id || "";
          let detailUrl = "";
          if (bbsId && nttId) {
            detailUrl = `https://www.gangnam.go.kr/portal/bbs/${bbsId}/${nttId}/view.do`;
          }
          return {
            name: title,
            target: "",
            deadline: normalizeDate(it.endDe || it.rcptEndDe || ""),
            summary: (it.cn || it.nttCn || "").trim().substring(0, 120),
            url: detailUrl || "https://www.gangnam.go.kr",
            source: "gangnam",
            agency: "강남구청"
          };
        });

      results = results.concat(matched);
    } catch (e) {
      log(`[gangnam] ${term} ERROR: ${e.message}`);
    }
    await sleep(800);
  }

  log(`[gangnam] 총 ${results.length}건`);
  return results;
}

async function fetchSocialServicePortal() {
  const searchTerms = ["심리상담", "심리지원", "정서발달", "부모상담", "정신건강"];
  let results = [];

  for (const term of searchTerms) {
    try {
      const url = `https://www.socialservice.or.kr:444/user/htmlEditor/rssList.do?searchWord=${encodeURIComponent(term)}`;
      const data = await fetchJson(url);

      let list = [];
      if (data.resultList) list = data.resultList;
      else if (data.list) list = data.list;
      else if (Array.isArray(data)) list = data;

      const matched = list.map(it => ({
        name: (it.title || it.svcNm || "").trim(),
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

우리는 서울 강남구에 위치한 심리상담센터(개인사업자 + 법인 병행)다. 다음 기회를 찾고 있다.
- 심리상담 바우처 제공기관 등록/모집 (마음투자, 전자바우처 등)
- 심리상담 위탁운영, 지정기관, 수행기관 모집 공고
- 지역사회서비스 투자사업 (아동·청소년 심리지원, 정서발달, 성인 심리지원 등)
- 심리안정 지원, 트라우마 상담, 자살예방 상담 운영기관 모집
- 인건비/운영비 보조금 지원사업 (소상공인, 사회적기업 등)
- 진로상담, 학교상담 위탁기관 모집
- EAP(근로자지원프로그램) 상담기관 등록
- 창업/사업화 지원 (심리상담센터가 받을 수 있는 것)

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
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEYS.gemini}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096
    }
  };

  const data = await fetchPost(url, body);
  return parseGeminiResponse(data);
}

function parseGeminiResponse(apiResponse) {
  const candidates = apiResponse.candidates || [];
  if (!candidates.length) return [];

  const candidate = candidates[0];
  const parts = candidate.content?.parts || [];

  let textParts = parts.filter(p => p.text !== undefined && p.thought !== true);
  if (!textParts.length) textParts = parts.filter(p => p.text !== undefined);

  let fullText = textParts.map(p => p.text || "").join(" ")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .trim();

  let results = null;
  try {
    const m = fullText.match(/\[[\s\S]*\]/);
    if (m) results = JSON.parse(m[0]);
  } catch (_) {}

  if (!results) return [];

  const grounding = candidate.groundingMetadata;
  const urlPool = [];

  if (grounding?.groundingChunks) {
    for (const chunk of grounding.groundingChunks) {
      const w = chunk.web;
      if (w?.uri && !w.uri.includes("vertexaisearch")) {
        urlPool.push({
          title: (w.title || "").toLowerCase(),
          uri: w.uri
        });
      }
    }
  }

  return results
    .map(r => ({
      name: String(r?.name || "").trim(),
      target: String(r?.target || "").trim(),
      deadline: String(r?.deadline || "").trim(),
      summary: String(r?.summary || "").trim().substring(0, 80),
      url: String(r?.url || "").trim(),
      source: "gemini",
      agency: String(r?.agency || "").trim()
    }))
    .filter(r => {
      if (!r.name || r.name.length < 5) return false;

      if (!r.url.startsWith("http") || r.url.includes("vertexaisearch")) {
        const words = r.name.toLowerCase().split(/\s+/);
        r.url =
          urlPool.find(u => words.some(w => w.length >= 2 && u.title.includes(w)))?.uri
          || urlPool[0]?.uri
          || `https://www.google.com/search?q=${encodeURIComponent(r.name)}`;
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

  const hasAnyRegionKeyword = [...GANGNAM_INCLUDE, ...REGION_EXCLUDE].some(k => text.includes(k));
  if (!hasAnyRegionKeyword) return 1;

  if (text.includes("강남") || text.includes("강남구")) return 4;
  if (GANGNAM_INCLUDE.some(k => text.includes(k))) return 2;

  return 0;
}

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

  return score;
}

function filterResults(results) {
  return results
    .filter(r => r && r.name && r.name.length >= 5)
    .filter(r => !isExpired(r.deadline))
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
      const cutoff = Date.now() - 90 * 86400000;
      const cleaned = {};
      for (const [k, v] of Object.entries(data)) {
        if (v > cutoff) cleaned[k] = v;
      }
      return cleaned;
    }
  } catch (_) {}
  return {};
}

function saveSeen(seenMap) {
  const fs = require("fs");
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seenMap, null, 2), "utf-8");
}

function seenKey(r) {
  return [
    (r.name || "").replace(/\s+/g, "").toLowerCase().substring(0, 40),
    (r.agency || "").replace(/\s+/g, "").toLowerCase().substring(0, 20),
    (r.deadline || "")
  ].join("|");
}

function filterNewOnly(results, seenMap) {
  return results.filter(r => !seenMap[seenKey(r)]);
}

function markAsSeen(results, seenMap) {
  const now = Date.now();
  for (const r of results) {
    seenMap[seenKey(r)] = now;
  }
  return seenMap;
}

function sortByDeadline(results) {
  return results.sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    const da = parseDeadline(a.deadline);
    const db = parseDeadline(b.deadline);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });
}

function buildCsv(results) {
  const BOM = "\uFEFF";
  const header = "번호,점수,사업명,출처,기관,마감일,링크\n";
  const rows = results.map((r, i) =>
    [i + 1, r.score || "", r.name, sourceLabel(r.source), r.agency, r.deadline, r.url]
      .map(v => '"' + String(v || "").replace(/"/g, '""') + '"')
      .join(",")
  ).join("\n");
  return BOM + header + rows;
}

function sourceLabel(src) {
  const map = {
    bizinfo: "기업마당",
    kstartup: "K-Startup",
    smes: "중소벤처24",
    g2b: "나라장터",
    gemini: "웹검색",
    seoul_openapi: "서울열린데이터",
    gangnam: "강남구청",
    socialservice: "사회서비스포털",
    bokjiro_central: "복지로(중앙)",
    bokjiro_local: "복지로(지자체)",
  };
  return map[src] || src;
}

function buildHtmlEmail(results, date) {
  const rows = results.map((r, i) => {
    const d = dDay(r.deadline);
    const dStr = d !== null ? (d >= 0 ? `D-${d}` : "마감") : "-";
    const dColor = d !== null && d >= 0 && d <= 14 ? "#dc2626" : (d !== null && d >= 0 ? "#16a34a" : "#94a3b8");

    const srcColors = {
      bizinfo: "#1d4ed8", kstartup: "#b45309", smes: "#16a34a", g2b: "#be185d",
      gemini: "#7c3aed", seoul_openapi: "#0369a1", gangnam: "#059669", socialservice: "#9333ea",
      bokjiro_central: "#0e7490", bokjiro_local: "#0e7490",
    };
    const srcBg = {
      bizinfo: "#dbeafe", kstartup: "#fef3c7", smes: "#dcfce7", g2b: "#fce7f3",
      gemini: "#f3e8ff", seoul_openapi: "#e0f2fe", gangnam: "#d1fae5", socialservice: "#fae8ff",
      bokjiro_central: "#cffafe", bokjiro_local: "#cffafe",
    };

    const c = srcColors[r.source] || "#555";
    const bg = srcBg[r.source] || "#f1f5f9";

    return `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 12px;color:#94a3b8;text-align:center;width:32px;">${i + 1}</td>
      <td style="padding:10px 12px;color:#334155;text-align:center;width:54px;font-weight:700;">${r.score || "-"}</td>
      <td style="padding:10px 12px;font-weight:600;min-width:220px;">${r.name}</td>
      <td style="padding:10px 12px;">
        <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;background:${bg};color:${c};">${sourceLabel(r.source)}</span>
      </td>
      <td style="padding:10px 12px;color:#475569;">${r.agency || "-"}</td>
      <td style="padding:10px 12px;font-weight:700;color:${dColor};">${r.deadline || "-"} (${dStr})</td>
      <td style="padding:10px 12px;">
        ${r.url ? `<a href="${r.url}" style="color:#3b82f6;text-decoration:none;">공고 →</a>` : "-"}
      </td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Noto Sans KR',Arial,sans-serif;">
<div style="max-width:980px;margin:0 auto;padding:32px 20px;">
  <div style="background:#fff;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 4px;">심리상담센터 정부지원사업 크롤링 결과</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 24px;">${date} 기준 · 총 ${results.length}건 · 서울 강남구 심리상담센터 대상</p>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
            <th style="padding:10px 12px;text-align:center;color:#475569;font-size:12px;">#</th>
            <th style="padding:10px 12px;text-align:center;color:#475569;font-size:12px;">점수</th>
            <th style="padding:10px 12px;text-align:left;color:#475569;font-size:12px;">사업명</th>
            <th style="padding:10px 12px;text-align:left;color:#475569;font-size:12px;">출처</th>
            <th style="padding:10px 12px;text-align:left;color:#475569;font-size:12px;">기관</th>
            <th style="padding:10px 12px;text-align:left;color:#475569;font-size:12px;">마감일</th>
            <th style="padding:10px 12px;text-align:left;color:#475569;font-size:12px;">링크</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:20px 0 0;">
      자동 크롤링 결과입니다. 마감일과 지원자격은 각 공고 원문에서 다시 확인하세요.
    </p>
  </div>
</div>
</body>
</html>`;
}

async function sendSlack(results, date) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    log("SLACK_WEBHOOK_URL 미설정 — 슬랙 전송 건너뜀");
    return;
  }

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `🧠 심리상담센터 지원사업 신규 공고 — ${results.length}건`, emoji: true }
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `${date} 기준 · 강남구 심리상담센터 대상 · 점수 상위 공고 중심` }]
    },
    { type: "divider" }
  ];

  const display = results.slice(0, 15);

  for (const r of display) {
    const d = dDay(r.deadline);
    const dStr = d !== null ? (d >= 0 ? `D-${d}` : "마감") : "-";
    const dEmoji = d !== null && d >= 0 && d <= 7 ? "🔴" : d !== null && d >= 0 && d <= 14 ? "🟠" : "🟢";
    const src = sourceLabel(r.source);
    const link = r.url ? `<${r.url}|공고 →>` : "-";

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*${r.name}*\n점수 ${r.score || "-"} · ${dEmoji} \`${r.deadline}\` (${dStr}) | ${src} | ${r.agency || "-"} | ${link}` }
    });
  }

  if (results.length > 15) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `_외 ${results.length - 15}건은 이메일 첨부 CSV를 확인하세요_` }]
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "🤖 심리상담센터 gov-crawler 자동 발송 · 마감일/자격은 원문 확인" }]
  });

  const slackBody = JSON.stringify({ blocks });
  const urlObj = new URL(webhookUrl);

  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: urlObj.hostname, path: urlObj.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(slackBody) }
    }, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { if (res.statusCode === 200) resolve(); else reject(new Error("Slack " + res.statusCode + ": " + d)); });
    });
    req.on("error", reject);
    req.write(slackBody);
    req.end();
  });

  log(`슬랙 전송 완료 (${display.length}건 표시)`);
}

async function sendEmail(html, csv, date, count) {
  const nodemailer = require("nodemailer");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_FROM, pass: process.env.EMAIL_APP_PASSWORD },
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
        const r = await fetchG2b(kw);
        allResults = allResults.concat(r);
        log(`[g2b] ${kw}: ${r.length}건`);
      } catch (e) { errorCount++; log(`[g2b] ${kw} ERROR: ${e.message}`); }
      await sleep(1200);
    }
  }

  try {
    const bizAll = await fetchBizinfoAll();
    let bizMatched = [];
    for (const kw of KEYWORDS) {
      const kwLower = kw.toLowerCase();
      const matched = bizAll.filter(it => {
        const text = normalizeText(compactText(it.name, it.summary, it.target, it.agency));
        return text.includes(kwLower);
      });
      bizMatched = bizMatched.concat(matched);
    }
    allResults = allResults.concat(bizMatched);
    log(`[bizinfo] 전체 ${bizAll.length}건 중 키워드 매칭: ${bizMatched.length}건`);
  } catch (e) { errorCount++; log(`[bizinfo] ERROR: ${e.message}`); }

  try {
    const seoulResults = await fetchSeoulOpenApi();
    allResults = allResults.concat(seoulResults);
  } catch (e) { errorCount++; log(`[seoul_openapi] ERROR: ${e.message}`); }

  try {
    const bokjiroResults = await fetchBokjiro();
    allResults = allResults.concat(bokjiroResults);
  } catch (e) { errorCount++; log(`[bokjiro] ERROR: ${e.message}`); }

  try {
    const gangnamResults = await fetchGangnamNotices();
    allResults = allResults.concat(gangnamResults);
  } catch (e) { errorCount++; log(`[gangnam] ERROR: ${e.message}`); }

  try {
    const socialResults = await fetchSocialServicePortal();
    allResults = allResults.concat(socialResults);
  } catch (e) { errorCount++; log(`[socialservice] ERROR: ${e.message}`); }

  if (KEYS.gemini) {
    log("\n--- Gemini 웹검색 시작 ---");
    for (const q of GEMINI_SEARCH_QUERIES) {
      try {
        const r = await fetchGemini(q);
        allResults = allResults.concat(r);
        log(`[gemini] ${q.substring(0, 30)}: ${r.length}건`);
      } catch (e) { errorCount++; log(`[gemini] ${q.substring(0, 30)} ERROR: ${e.message}`); }
      await sleep(3000);
    }
  }

  allResults = filterResults(allResults);
  allResults = deduplicateResults(allResults);
  allResults = sortByDeadline(allResults);

  if (allResults.length > 100) allResults = allResults.slice(0, 100);

  const seenMap = loadSeen();
  const newResults = filterNewOnly(allResults, seenMap);

  log(`\n전체 ${allResults.length}건 중 신규: ${newResults.length}건 (오류 ${errorCount}건)`);

  if (newResults.length === 0) {
    log("신규 공고 없음. 이메일 발송 생략.");
    return;
  }

  const csv = buildCsv(newResults);
  const html = buildHtmlEmail(newResults, today);

  const fs = require("fs");
  fs.writeFileSync(`result_${today}.csv`, csv);
  log(`CSV 저장 완료: result_${today}.csv`);

  if (process.env.EMAIL_FROM && process.env.EMAIL_TO && process.env.EMAIL_APP_PASSWORD) {
    await sendEmail(html, csv, today, newResults.length);
  } else {
    log("이메일 환경변수 미설정 — 이메일 전송 건너뜀");
  }

  await sendSlack(newResults, today);

  markAsSeen(newResults, seenMap);
  saveSeen(seenMap);
  log("seen.json 업데이트 완료");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
