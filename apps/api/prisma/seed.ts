/**
 * 에너지엑스 인사평가 — 실 임직원 데이터 시드 (v5, 2026-06-05)
 *
 * 원본: 에너지엑스_임직원명부(조직도연동).xlsx — 117명, 5그룹, 9본부, 20팀
 * 포함: 조직·사용자·RuleSet·평가주기·스케줄·KPI양식·카테고리정책
 * 미포함: KPI, 평가, 결과 (실 사용자가 직접 입력)
 * 초기 비밀번호: Passw0rd!  /  HR 관리자: jjh@energyx.co.kr (정재훈)
 */
import {
  PrismaClient, Role, Position, JobLevel, DepartmentType,
  CycleStatus, CycleType, KpiCategory, KpiGroup, MeasureType, VisibilityScope,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const POS_MAP: Record<string,Position> = {
  '대표이사':Position.ceo, '부대표':Position.vice_president, '상무':Position.executive,
  '이사':Position.director, '수석':Position.principal, '본부장':Position.division_head,
  '팀장':Position.team_lead, '책임':Position.chief, '선임':Position.senior, '프로':Position.pro,
};
const JL_MAP: Record<string,JobLevel|null> = {
  '대표이사':null,'부대표':null,'상무':null,'이사':null,
  '수석':JobLevel.senior_plus,'본부장':JobLevel.division_head,'팀장':JobLevel.team_lead,
  '책임':JobLevel.senior_plus,'선임':JobLevel.senior_plus,'프로':JobLevel.senior_minus,
};
const SAL: Record<Position,number> = {
  [Position.ceo]:250_000_000,[Position.vice_president]:180_000_000,[Position.executive]:150_000_000,
  [Position.director]:130_000_000,[Position.principal]:110_000_000,[Position.division_head]:128_000_000,
  [Position.team_lead]:98_000_000,[Position.chief]:84_000_000,[Position.senior]:72_000_000,[Position.pro]:58_000_000,
};
function getRole(p:string,e:string):Role{
  if(e==='jjh@energyx.co.kr') return Role.hr_admin;
  if(p==='대표이사'||p==='부대표'||p==='본부장') return Role.division_head;
  if(p==='팀장') return Role.team_lead;
  return Role.employee;
}
function getScope(p:string,e:string):VisibilityScope{
  if(e==='jjh@energyx.co.kr') return VisibilityScope.company;
  if(p==='대표이사'||p==='부대표') return VisibilityScope.group;
  if(p==='본부장') return VisibilityScope.division;
  if(p==='팀장') return VisibilityScope.team;
  return VisibilityScope.self;
}

const ROSTER:[string,string,string,string,string,string][]=[
  ['이노베이션그룹','','','대표이사','정보경','bjung@energyx.co.kr'],
  ['이노베이션그룹','','IT개발팀','팀장','송지훈','jsong1699@energyx.co.kr'],
  ['이노베이션그룹','','IT개발팀','책임','정종만','jjeong@energyx.co.kr'],
  ['이노베이션그룹','','IT개발팀','프로','이승원','slee6873@energyx.co.kr'],
  ['이노베이션그룹','','IT개발팀','프로','전인종','ijeon5374@energyx.co.kr'],
  ['이노베이션그룹','','IT개발팀','프로','이청흰','clee0597@energyx.co.kr'],
  ['이노베이션그룹','','IT개발팀','프로','김호정','hkim3553@energyx.co.kr'],
  ['이노베이션그룹','','IT개발팀','프로','전병민','bjeon7765@energyx.co.kr'],
  ['이노베이션그룹','','IT개발팀','프로','김지원','jkim2006@energyx.co.kr'],
  ['이노베이션그룹','','연구팀','책임','서민정','mjseo@energyx.co.kr'],
  ['이노베이션그룹','','연구팀','프로','김병민','bkim4124@energyx.co.kr'],
  ['이노베이션그룹','','연구팀','프로','고수민','sgo4422@energyx.co.kr'],
  ['건축설계그룹','','','대표이사','김광영','kky@energyx.co.kr'],
  ['건축설계그룹','건축디자인본부','','본부장','이교재','kjlee@energyx.co.kr'],
  ['건축설계그룹','건축디자인본부','','선임','박준산','jspark@energyx.co.kr'],
  ['건축설계그룹','건축디자인본부','','선임','변준범','byunjb@energyx.co.kr'],
  ['건축설계그룹','건축디자인본부','','선임','오민진','mjoh@energyx.co.kr'],
  ['건축설계그룹','주거디자인본부','','본부장','진정근','jkjin@energyx.co.kr'],
  ['건축설계그룹','주거디자인본부','','선임','사공환희','sgh@energyx.co.kr'],
  ['건축설계그룹','주거디자인본부','','선임','정욱','wjung7929@energyx.co.kr'],
  ['건축설계그룹','주거디자인본부','','선임','임남혁','naml1511@energyx.co.kr'],
  ['건축설계그룹','주거디자인본부','','프로','차가을','gcha2278@energyx.co.kr'],
  ['건축설계그룹','친환경디자인본부','','본부장','김영진','yjkim@energyx.co.kr'],
  ['건축설계그룹','친환경디자인본부','','선임','정소라','jsr@energyx.co.kr'],
  ['건축설계그룹','친환경디자인본부','','선임','진성현','jsh@energyx.co.kr'],
  ['건축설계그룹','친환경디자인본부','','프로','백선경','sbaek1591@energyx.co.kr'],
  ['엔지니어링그룹','','','대표이사','송상민','ssong@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','','본부장','박용진','yjpark@energyx.co.kr'],
  ['엔지니어링그룹','감리본부','','본부장','이경재','klee@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','신재생기술1팀','책임','윤은식','eyoon@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','신재생기술1팀','선임','조경진','kchoi@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','신재생기술1팀','프로','류수경','sryu9508@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','신재생기술2팀','책임','조유현','ycho8609@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','신재생기술2팀','책임','강연군','ykang0359@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','신재생기술2팀','선임','장동식','djang8065@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','신재생기술2팀','선임','임홍식','hlim9359@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','신재생기술2팀','선임','김현규','hkim4000@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','신재생기술3팀','책임','박준영','jpark1022@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','SI팀','이사','성창현','csung5934@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','SI팀','책임','정순경','sjung8264@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','SI팀','책임','신수연','sshin9632@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','SI팀','책임','최형석','hchoi0287@energyx.co.kr'],
  ['엔지니어링그룹','신재생기술본부','SI팀','선임','지원영','wji2117@energyx.co.kr'],
  ['엔지니어링그룹','감리본부','기술팀','상무','민명기','mmin@energyx.co.kr'],
  ['엔지니어링그룹','감리본부','기술팀','선임','서용준','jyong7071@energyx.co.kr'],
  ['엔지니어링그룹','','입찰팀','책임','김현석','hkim9099@energyx.co.kr'],
  ['엔지니어링그룹','','입찰팀','선임','허은혁','eheo@energyx.co.kr'],
  ['엔지니어링그룹','','기술영업팀','상무','서성원','sseo@energyx.co.kr'],
  ['엔지니어링그룹','','기술영업팀','책임','김복수','bkim4965@energyx.co.kr'],
  ['엔지니어링그룹','','기술개발팀','책임','지선용','sji8562@energyx.co.kr'],
  ['친환경기술그룹','','','대표이사','박창영','pcy@energyx.co.kr'],
  ['친환경기술그룹','','','부대표','홍종필','jphong@energyx.co.kr'],
  ['친환경기술그룹','','','책임','유진옥','Jinokyu@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','','본부장','이대길','dglee@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','','본부장','김현수','hskim@energyx.co.kr'],
  ['친환경기술그룹','친환경SA본부','','본부장','임하나','hnlim@energyx.co.kr'],
  ['친환경기술그룹','환경평가본부','','본부장','김연아','yakim@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 1팀','책임','박신규','skpark@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 1팀','책임','양리나','yangrn@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 1팀','선임','정지수','jsjung@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 1팀','프로','박예림','ypark8689@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 2팀','책임','김기범','kbkim@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 2팀','선임','권혁래','kwonhr@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 2팀','프로','이혜인','lhi@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 2팀','프로','윤재희','jyun8160@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 3팀','책임','권순현','shkwon@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 3팀','선임','심효진','shimhj@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 3팀','선임','유다정','djyou@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 3팀','선임','민수지','sjmin@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 3팀','선임','정석명','sjung2682@energyx.co.kr'],
  ['친환경기술그룹','친환경CS1본부','CS1본부 3팀','프로','심민서','mshim4824@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 1팀','책임','강보형','bhkang@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 1팀','책임','최유창','ucchoi@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 1팀','선임','손혜진','hjson@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 1팀','프로','이하람','hrlee@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 2팀','책임','김준호','jhkim@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 2팀','선임','유예지','yyu4345@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 2팀','프로','박은혜','parkeh@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 2팀','프로','김예진','ykim7242@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 3팀','책임','박승현','shpark@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 3팀','책임','서지혜','jiheyseo@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 3팀','선임','나대수','dsna@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','CS2본부 3팀','프로','조영재','ycho7405@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','LEED팀','선임','박진성','jpark3185@energyx.co.kr'],
  ['친환경기술그룹','친환경CS2본부','LEED팀','선임','신현정','hjshin@energyx.co.kr'],
  ['친환경기술그룹','친환경SA본부','친환경SA1팀','책임','손대승','dsson@energyx.co.kr'],
  ['친환경기술그룹','친환경SA본부','친환경SA1팀','책임','김제영','kjy@energyx.co.kr'],
  ['친환경기술그룹','친환경SA본부','친환경SA1팀','프로','권숙원','gsw@energyx.co.kr'],
  ['친환경기술그룹','친환경SA본부','친환경SA1팀','프로','신경준','kshin5239@energyx.co.kr'],
  ['친환경기술그룹','친환경SA본부','친환경SA1팀','프로','이다현','dlee7821@energyx.co.kr'],
  ['친환경기술그룹','친환경SA본부','친환경SA2팀','책임','서종현','jhseo@energyx.co.kr'],
  ['친환경기술그룹','친환경SA본부','친환경SA2팀','선임','이기철','kclee@energyx.co.kr'],
  ['친환경기술그룹','친환경SA본부','친환경SA2팀','프로','손령빈','rson6958@energyx.co.kr'],
  ['친환경기술그룹','친환경SA본부','친환경SA2팀','프로','김미소','mkim4819@energyx.co.kr'],
  ['친환경기술그룹','환경평가본부','환경평가팀','책임','한상윤','hsy@energyx.co.kr'],
  ['친환경기술그룹','환경평가본부','환경평가팀','선임','오재용','ohjy@energyx.co.kr'],
  ['친환경기술그룹','환경평가본부','환경평가팀','프로','이유나','leeyn@energyx.co.kr'],
  ['친환경기술그룹','환경평가본부','환경평가팀','수석','백소영','sback5964@energyx.co.kr'],
  ['친환경기술그룹','환경평가본부','환경평가팀','책임','설수빈','ssul7587@energyx.co.kr'],
  ['친환경기술그룹','환경평가본부','환경평가팀','선임','이상헌','slee6477@energyx.co.kr'],
  ['친환경기술그룹','환경평가본부','환경평가팀','프로','이기환','glee8626@energyx.co.kr'],
  ['친환경기술그룹','','기술전략팀','책임','이두환','dlee3517@energyx.co.kr'],
  ['경영그룹','','','대표이사','박성현','spark@energyx.ai'],
  ['경영그룹','','','대표이사','홍두화','dhong@energyx.co.kr'],
  ['경영그룹','경영관리본부','','본부장','이현우','hlee5032@energyx.co.kr'],
  ['경영그룹','경영관리본부','경영기획팀','선임','김명근','mkim@energyx.co.kr'],
  ['경영그룹','경영관리본부','경영기획팀','선임','최순기','schoi3503@energyx.co.kr'],
  ['경영그룹','경영관리본부','경영기획팀','프로','권명은','ykwon8354@energyx.co.kr'],
  ['경영그룹','경영관리본부','경영기획팀','프로','장한샘','hjang7305@energyx.co.kr'],
  ['경영그룹','경영관리본부','경영기획팀','선임','이임태','ilee@energyx.co.kr'],
  ['경영그룹','경영관리본부','인사총무팀','수석','정재훈','jjh@energyx.co.kr'],
  ['경영그룹','경영관리본부','인사총무팀','책임','김지희','jkim0609@energyx.co.kr'],
  ['경영그룹','경영관리본부','인사총무팀','프로','진희선','hjin3542@energyx.co.kr'],
  ['경영그룹','경영관리본부','재무팀','책임','류정미','jryu6459@energyx.co.kr'],
  ['경영그룹','경영관리본부','재무팀','책임','최선영','schoi6133@energyx.co.kr'],
  ['경영그룹','경영관리본부','재무팀','선임','어라윤','reo9921@energyx.co.kr'],
  ['경영그룹','경영관리본부','재무팀','프로','김수성','skim4817@energyx.co.kr'],
];

const RS_DATA={
  gradeScale:[{grade:'S',min:96,max:100},{grade:'A',min:91,max:95},{grade:'B',min:85,max:90},{grade:'C',min:80,max:84},{grade:'D',min:0,max:79}],
  gradingScales:{
    amount:[{grade:'S',minRate:110.0001,maxRate:null},{grade:'A',minRate:101,maxRate:110},{grade:'B',minRate:100,maxRate:100},{grade:'C',minRate:90,maxRate:99},{grade:'D',minRate:0,maxRate:89.9999}],
    rate:[{grade:'S',minRate:110.0001,maxRate:null},{grade:'A',minRate:101,maxRate:110},{grade:'B',minRate:100,maxRate:100},{grade:'C',minRate:90,maxRate:99},{grade:'D',minRate:0,maxRate:89.9999}],
  },
  poolRatios:{excellent:{S:10,A:20,B:50,C:15,D:5},standard:{S:5,A:10,B:60,C:20,D:5},poor:{S:3,A:7,B:60,C:25,D:5}},
  raiseRates:{S:7,A:5,B:3,C:1,D:0},
  // 가중치 정책(설정 가능 — ScoringService 가 weightPolicy 에서 읽음).
  //  - 연봉/등급 반영 = 성과평가(KPI) 100%. 역량평가 점수는 미반영(참고용 백데이터) → competencyWeight 제거.
  //  - kpiGroupWeights: 성과평가 KPI 내부 그룹 가중치(성과중심 80 + 협업·성장 20). KpiGroup 비율 강제(kpis.submit)에서 사용.
  //  - qualitativeMaxPercent: 정성(isQualitative) KPI 합계 상한(%).
  weightPolicy:{totalMustEqual:100,qualitativeMaxPercent:30,kpiGroupWeights:{performance_core:80,collaboration_growth:20},evaluatorWeights:{teamLeader:0.5,divisionHead:0.3,ceo:0.2},groupTierBonus:{excellent:2,standard:0,poor:-1},gradeScale:[{minScore:96,grade:'S'},{minScore:90,grade:'A'},{minScore:80,grade:'B'},{minScore:70,grade:'C'},{minScore:0,grade:'D'}]},
};

async function main(){
  const passwordHash=await bcrypt.hash('Passw0rd!',10);

  // 0. 전체 정리
  for(const t of ['auditLog','notification','compensation','appeal','evaluationResult','comment','kpiScore','evaluation','review','achievement','kpi','kpiTemplateItem','kpiTemplate','gradePool','groupPerformance','competencyResponse','competencyQuestion','monthlyPerformance','cycleSchedule','evaluationCycle','ruleSet','user','department'] as const)
    await(prisma[t]as any).deleteMany();

  // 1. 부서
  const D:Record<string,string>={};
  const groups=[...new Set(ROSTER.map(r=>r[0]))];
  for(const g of groups){const d=await prisma.department.create({data:{name:g,type:DepartmentType.group,isEngineering:g==='엔지니어링그룹'}});D[`${g}||`]=d.id;}
  for(const key of [...new Set(ROSTER.filter(r=>r[1]).map(r=>`${r[0]}|${r[1]}`))]){
    const[g,div]=key.split('|');
    const d=await prisma.department.create({data:{name:div,type:DepartmentType.division,parentId:D[`${g}||`],isEngineering:g==='엔지니어링그룹'}});
    D[`${g}|${div}|`]=d.id;
  }
  for(const key of [...new Set(ROSTER.filter(r=>r[2]).map(r=>`${r[0]}|${r[1]}|${r[2]}`))]){
    const[g,div,team]=key.split('|');
    const parentId=div?D[`${g}|${div}|`]:D[`${g}||`];
    const d=await prisma.department.create({data:{name:team,type:DepartmentType.team,parentId,isEngineering:g==='엔지니어링그룹'}});
    D[`${g}|${div}|${team}`]=d.id;
  }

  // 2. 관리자 결정 (순서 독립적 · 순수 함수)
  // 직급 서열: 인덱스가 작을수록 상위. 같은 인덱스는 동급.
  const ORD=['대표이사','부대표','상무','이사','수석','본부장','팀장','책임','선임','프로'];
  const rank=(pos:string)=>{const i=ORD.indexOf(pos);return i<0?ORD.length:i;};

  // 그룹 CEO(대표이사) 중 "정렬상 첫 번째"를 그룹 루트로 사용(공동대표 처리)
  function groupCeo(g:string):[string,string,string,string,string,string]|undefined{
    const ceos=ROSTER.filter(r=>r[0]===g&&!r[1]&&!r[2]&&r[3]==='대표이사');
    return ceos[0];
  }
  // 본부장(div head) 찾기
  function divHead(g:string,div:string):[string,string,string,string,string,string]|undefined{
    if(!div)return undefined;
    return ROSTER.find(r=>r[0]===g&&r[1]===div&&!r[2]&&r[3]==='본부장');
  }
  // 본부/그룹 상위로 보고(본부장 → 없으면 그룹 CEO). 본인 제외.
  function reportUp(g:string,div:string,email:string):string|null{
    const dh=divHead(g,div);
    if(dh&&dh[5]!==email)return dh[5];
    const ceo=groupCeo(g);
    if(ceo&&ceo[5]!==email)return ceo[5];
    return null; // 진짜 조직 루트(그룹 CEO 본인)
  }

  // 한 row의 managerEmail 을 ROSTER 만으로 순수 계산(생성 순서 무관)
  function mgr(row:[string,string,string,string,string,string]):string|null{
    const[g,div,team,pos,,email]=row;

    // 그룹 최상위 대표이사: 정렬상 첫 CEO 가 루트(null), 나머지 공동대표는 첫 CEO 에 매달림
    if(pos==='대표이사'){
      const root=groupCeo(g);
      return root&&root[5]!==email?root[5]:null;
    }
    // 부대표: 그룹 CEO 산하
    if(pos==='부대표'){const ceo=groupCeo(g);return ceo&&ceo[5]!==email?ceo[5]:null;}
    // 본부장: 그룹 CEO 산하
    if(pos==='본부장'){const ceo=groupCeo(g);return ceo?.[5]??null;}
    // 팀장: 본부장 → 그룹 CEO
    if(pos==='팀장'){return reportUp(g,div,email);}

    // 팀 소속 구성원(팀장 제외)
    if(team){
      // 1순위: 팀장
      const lead=ROSTER.find(r=>r[0]===g&&r[1]===div&&r[2]===team&&r[3]==='팀장');
      if(lead)return lead[5];
      // 2순위: 팀 내에서 본인보다 "엄격히 상위" 직급 중 가장 높은 사람(effective lead).
      //        동급/하위에게는 절대 매달지 않음(역전 방지). 동순위는 가장 먼저 등장한 사람으로 결정(결정적).
      const myRank=rank(pos);
      const seniors=ROSTER.filter(r=>r[0]===g&&r[1]===div&&r[2]===team&&r[5]!==email&&rank(r[3])<myRank);
      if(seniors.length){
        seniors.sort((a,b)=>rank(a[3])-rank(b[3]));
        return seniors[0][5];
      }
      // 3순위: 팀 내 상위가 없으면 옆사람(동급 책임끼리 서로 매다는 버그)으로 가지 않고 본부/그룹으로 보고
      return reportUp(g,div,email);
    }

    // 본부 직속(팀 없음): 본부장 → 그룹 CEO. 본부장 본인보다 하위여야 매달림.
    if(div&&!team){
      const dh=divHead(g,div);
      if(dh&&dh[5]!==email&&rank(dh[3])<rank(pos))return dh[5];
      const ceo=groupCeo(g);return ceo&&ceo[5]!==email?ceo[5]:null;
    }

    // 그룹 직속(본부·팀 없음): 그룹 CEO 산하
    if(!div&&!team){const ceo=groupCeo(g);return ceo&&ceo[5]!==email?ceo[5]:null;}

    return null;
  }

  // 3. 사용자 — 1차: 전원 생성(managerId 미설정), 2차: managerId 일괄 갱신
  const E2ID:Record<string,string>={};
  // managerEmail 을 생성 전에 ROSTER 만으로 전부 확정(순서 독립)
  const MGR_EMAIL:Record<string,string|null>={};
  for(const row of ROSTER)MGR_EMAIL[row[5]]=mgr(row);

  // 1차 패스: 모든 사용자 생성(managerId 는 나중에)
  for(const row of ROSTER){
    const[g,div,team,posStr,name,email]=row;
    const pos=POS_MAP[posStr]??Position.pro;
    const dk=team?`${g}|${div}|${team}`:div?`${g}|${div}|`:`${g}||`;
    const u=await prisma.user.create({data:{email,name,passwordHash,role:getRole(posStr,email),position:pos,jobLevel:JL_MAP[posStr]??null,departmentId:D[dk],managerId:null,visibilityScope:getScope(posStr,email),currentSalary:null,mustChangePassword:true}});
    E2ID[email]=u.id;
  }

  // 2차 패스: 모든 id 확정 후 managerId 설정. null 은 오직 진짜 조직 루트(그룹 CEO).
  for(const row of ROSTER){
    const email=row[5];
    const me=MGR_EMAIL[email];
    if(!me)continue; // 루트
    const managerId=E2ID[me];
    if(!managerId)throw new Error(`[seed] manager 해석 실패: ${email} → ${me} (E2ID 누락)`);
    await prisma.user.update({where:{id:E2ID[email]},data:{managerId}});
  }

  // 4. KPI 카테고리 정책
  const AC=[KpiCategory.revenue,KpiCategory.construction,KpiCategory.orders,KpiCategory.collaboration,KpiCategory.development];
  const NC=[KpiCategory.construction,KpiCategory.collaboration,KpiCategory.development];
  for(const p of[Position.ceo,Position.vice_president,Position.executive,Position.director,Position.division_head,Position.team_lead])
    await prisma.kpiCategoryPolicy.upsert({where:{position:p},create:{position:p,allowed:AC},update:{allowed:AC}});
  for(const p of[Position.principal,Position.chief,Position.senior,Position.pro])
    await prisma.kpiCategoryPolicy.upsert({where:{position:p},create:{position:p,allowed:NC},update:{allowed:NC}});

  // 5. RuleSet + 주기
  const rs=await prisma.ruleSet.create({data:RS_DATA});
  const cycle=await prisma.evaluationCycle.create({data:{name:'2026년 상반기 정기 성과평가',year:2026,startDate:new Date('2026-03-01T00:00:00Z'),endDate:new Date('2026-08-31T23:59:59Z'),status:CycleStatus.mid_review,cycleType:CycleType.MIDTERM,ruleSetId:rs.id}});

  // 6. 스케줄
  const allDepts=Object.values(D);
  for(const p of[{phase:'preparation',s:'2026-03-01',d:'2026-03-31',l:true},{phase:'self',s:'2026-04-01',d:'2026-05-10',l:true},{phase:'downward1',s:'2026-05-11',d:'2026-06-14',l:false},{phase:'downward2',s:'2026-06-15',d:'2026-06-28',l:false},{phase:'result',s:'2026-07-01',d:'2026-08-31',l:false}])
    await prisma.cycleSchedule.create({data:{cycleId:cycle.id,phase:p.phase,startDate:new Date(`${p.s}T00:00:00Z`),dueDate:new Date(`${p.d}T23:59:59Z`),notifyOffsets:[7,3,1],notifyEnabled:true,targetUserIds:[],targetDeptIds:allDepts,isLocked:p.l}});

  // 7. KPI 양식
  await prisma.kpiTemplate.create({data:{cycleId:cycle.id,jobLevel:JobLevel.division_head,items:{create:[{category:KpiCategory.construction,group:KpiGroup.performance_core,sampleStrategy:'본부 공정액 달성',defaultMeasureType:MeasureType.amount,defaultWeight:45,isQualitative:false},{category:KpiCategory.orders,group:KpiGroup.performance_core,sampleStrategy:'본부 수주액 달성',defaultMeasureType:MeasureType.amount,defaultWeight:35,isQualitative:false},{category:KpiCategory.collaboration,group:KpiGroup.collaboration_growth,sampleStrategy:'협업성과(10건)',defaultMeasureType:MeasureType.count,defaultWeight:10,isQualitative:false},{category:KpiCategory.development,group:KpiGroup.collaboration_growth,sampleStrategy:'조직 역량 강화',defaultMeasureType:MeasureType.qualitative,defaultWeight:10,isQualitative:true}]}}});
  await prisma.kpiTemplate.create({data:{cycleId:cycle.id,jobLevel:JobLevel.team_lead,items:{create:[{category:KpiCategory.revenue,group:KpiGroup.performance_core,sampleStrategy:'팀 매출 목표 달성',defaultMeasureType:MeasureType.amount,defaultWeight:45,isQualitative:false},{category:KpiCategory.orders,group:KpiGroup.performance_core,sampleStrategy:'팀 수주·업무수행',defaultMeasureType:MeasureType.amount,defaultWeight:35,isQualitative:false},{category:KpiCategory.collaboration,group:KpiGroup.collaboration_growth,sampleStrategy:'팀간 협업 지원',defaultMeasureType:MeasureType.count,defaultWeight:10,isQualitative:false},{category:KpiCategory.development,group:KpiGroup.collaboration_growth,sampleStrategy:'팀원 코칭·역량강화',defaultMeasureType:MeasureType.qualitative,defaultWeight:10,isQualitative:true}]}}});
  await prisma.kpiTemplate.create({data:{cycleId:cycle.id,jobLevel:JobLevel.senior_plus,items:{create:[{category:KpiCategory.revenue,group:KpiGroup.performance_core,sampleStrategy:'담당 매출 기여',defaultMeasureType:MeasureType.amount,defaultWeight:45,isQualitative:false},{category:KpiCategory.orders,group:KpiGroup.performance_core,sampleStrategy:'수주·업무수행 성과',defaultMeasureType:MeasureType.amount,defaultWeight:35,isQualitative:false},{category:KpiCategory.collaboration,group:KpiGroup.collaboration_growth,sampleStrategy:'타부서 협업 지원',defaultMeasureType:MeasureType.count,defaultWeight:10,isQualitative:false},{category:KpiCategory.development,group:KpiGroup.collaboration_growth,sampleStrategy:'AI 활용 자기개발',defaultMeasureType:MeasureType.qualitative,defaultWeight:10,isQualitative:true}]}}});
  await prisma.kpiTemplate.create({data:{cycleId:cycle.id,jobLevel:JobLevel.senior_minus,items:{create:[{category:KpiCategory.revenue,group:KpiGroup.performance_core,sampleStrategy:'담당 업무 처리량',defaultMeasureType:MeasureType.amount,defaultWeight:50,isQualitative:false},{category:KpiCategory.orders,group:KpiGroup.performance_core,sampleStrategy:'업무수행 정확도',defaultMeasureType:MeasureType.rate,defaultWeight:30,isQualitative:false},{category:KpiCategory.collaboration,group:KpiGroup.collaboration_growth,sampleStrategy:'협업 지원 건수',defaultMeasureType:MeasureType.count,defaultWeight:10,isQualitative:false},{category:KpiCategory.development,group:KpiGroup.collaboration_growth,sampleStrategy:'직무 교육 이수',defaultMeasureType:MeasureType.qualitative,defaultWeight:10,isQualitative:true}]}}});

  const[cU,cD]=await Promise.all([prisma.user.count(),prisma.department.count()]);
  const byRole=await prisma.user.groupBy({by:['role'],_count:true});
  const byPos=await prisma.user.groupBy({by:['position'],_count:true});
  console.log(`\n✅ Seed v5 완료 — 실 임직원 ${cU}명, 부서 ${cD}개`);
  console.log('역할별:'); byRole.forEach(r=>console.log(`  ${r.role}: ${r._count}명`));
  console.log('직급별:'); byPos.forEach(r=>console.log(`  ${r.position}: ${r._count}명`));
  console.log('\nHR 관리자: jjh@energyx.co.kr (정재훈) / 초기 PW: Passw0rd!\n');
}

main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect());
