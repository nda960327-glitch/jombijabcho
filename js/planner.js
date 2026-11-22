/* THE WEEKLY Times — 주간 플래너 화면.
   mindinside.kr/blog/ops '운영팀 플래너'(hongcbt opsplanner.js, 2026-11-23 운영본) 코드를 그대로 옮겼다.
   바꾼 곳만: 서버 대신 js/app.js 의 로컬 창구(W.get/W.post)를 부르고, 운영자 로그인·시험 메일 보내기를 뺐고, 로그아웃 자리에 동기화 창을 달았다. */
(function(){
var W=window.MI,$=function(id){return document.getElementById(id)},E=W.esc;
var CK='mi_ops_code';
function ss(k,v){try{if(v===undefined)return sessionStorage.getItem(k)||'';if(v)sessionStorage.setItem(k,v);else sessionStorage.removeItem(k)}catch(e){return''}}
function p2(n){return(n<10?'0':'')+n}
function ymd(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
function pd(s){return new Date(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10))}
function addD(s,n){var d=pd(s);d.setDate(d.getDate()+n);return ymd(d)}
function monOf(s){var d=pd(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return ymd(d)}
var EN=['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'],KO=['월','화','수','목','금','토','일'],WD=['일','월','화','수','목','금','토'];
function lab(s){var d=pd(s);return(d.getMonth()+1)+'/'+d.getDate()+' ('+WD[d.getDay()]+')'}
function wno(s){var d=pd(s);d.setDate(d.getDate()-((d.getDay()+6)%7)+3);var y=new Date(d.getFullYear(),0,4);return 1+Math.round(((d-y)/86400000-3+((y.getDay()+6)%7))/7)}
var code=ss(CK),view='week',TODAY=ymd(new Date()),anchor=monOf(TODAY),items=[],overdue=[],people=[],COLORS=[],me=null,ownerF='',srchQ='',loaded='',dragId='';
var qs=new URLSearchParams(location.search);if(qs.get('view')==='done')view='done';
function pc(n){for(var i=0;i<people.length;i++)if(people[i].name===n)return people[i].color;return ''}
function hl(t){return E(t).replace(/\{@([^|{}]{1,20})\|([^{}]{1,500})\}/g,function(m,w,x){return '<mark style="background:'+(pc(w)||'#fff176')+'">'+x+'</mark>'}).replace(/\n/g,'<br>')}
function cred(){return code?{code:code}:{session:W.session()}}
function showLogin(msg){if(msg)W.toast(msg)}
// 서버 대신 이 기기 안의 창구(js/app.js) — 돌려주는 모양은 서버와 같다
function api(p){return W.get(p)}
function post(p,b){return W.post(p,b)}
function denied(j,hadCode){if(j._st===429||j.error==='locked'){showLogin(j.message||'요청이 너무 많아요. 잠시 뒤 다시 해 주세요.');return true}
 if(j._st!==403)return false;if(hadCode){code='';ss(CK,'')}
 showLogin(hadCode?'코드가 맞지 않아요.':j.error==='not-admin'?'이 계정('+(j.email||'이메일 없음')+')은 운영자 명단에 없어요. 운영자 구글·네이버 계정으로 다시 로그인하거나 코드를 넣어 주세요.':(W.session()?'로그인이 끝났어요. 다시 로그인해 주세요.':''));return true}
function range(){if(view==='month'){var a=pd(anchor);a.setDate(1);var f=monOf(ymd(a)),e=new Date(a.getFullYear(),a.getMonth()+1,0);return[f,addD(monOf(ymd(e)),6)]}return[anchor,addD(anchor,6)]}
function enter(j){me=j.me||me;if(j.people)people=j.people;if(j.colors)COLORS=j.colors;if(j.today)TODAY=j.today}
function load(){if(view==='done')return loadDone();if(view==='search')return doSearch();var r=range(),had=!!code;
 return api('/admin/opscal?from='+r[0]+'&to='+r[1]).then(function(j){if(denied(j,had))return;if(!j.ok){W.toast('불러오지 못했어요');return}
  items=j.items||[];overdue=j.overdue||[];loaded=r.join('~');enter(j);draw()}).catch(function(){W.toast('불러오지 못했어요')})}
function vis(e){return !ownerF||e.owner===ownerF||(e.kind==='wmemo')}
function sortIt(a,b){return a.day<b.day?-1:a.day>b.day?1:(a.start||'')<(b.start||'')?-1:(a.start||'')>(b.start||'')?1:a.created-b.created}
function badges(e){var h='';if(e.kind!=='task'||e.status==='done')return '';
 if(e.day<TODAY)h+='<i class="bd late">지남</i>';else if(e.day===TODAY)h+='<i class="bd tdy">오늘</i>';else if(e.day===addD(TODAY,1))h+='<i class="bd soon">내일</i>';
 if(e.carried)h+='<i class="bd cr" title="'+E(lab(e.origDay||e.day))+'부터">↪ '+e.carried+'주째</i>';return h}
function stTitle(s){return s==='done'?'완료 — 누르면 할 일로':s==='doing'?'진행 중 — 누르면 완료':'할 일 — 누르면 진행 중'}
function itHtml(e,mini){var oc=pc(e.owner),st=' style="--oc:'+(oc||'#c9c2b6')+'"',dr=e.series?'':' draggable="true"',da=' data-id="'+E(e.id)+'" data-day="'+e.day+'"'+dr;
 var tip=' title="'+E((e.owner?e.owner+' · ':'')+(e.memo||'').slice(0,120))+'"';
 if(e.kind==='event')return '<div class="it ev"'+da+st+tip+'>'+(e.start?'<b class="tm">'+E(e.start)+'</b>':'')+hl(e.title)+(e.repeat?'<i class="rp" title="'+(e.repeat==='weekly'?'매주':'매월')+' 반복">↻</i>':'')+'</div>';
 if(e.kind==='task'){if(mini)return '<div class="it tk"'+da+st+tip+'>'+(e.status==='done'?'● ':e.status==='doing'?'◐ ':'○ ')+hl(e.title)+'</div>';
  return '<div class="it tk '+E(e.status)+'"'+da+st+tip+'><button type="button" class="ck '+E(e.status)+'" data-st="'+E(e.id)+'" title="'+stTitle(e.status)+'" aria-label="'+stTitle(e.status)+'"></button><span class="tx">'+hl(e.title)+(e.owner?'<i class="ow" title="'+E(e.owner)+'"></i>':'')+badges(e)+'</span></div>'}
 return '<div class="it mm"'+da+tip+'>'+(e.title?'<b>'+hl(e.title)+'</b> ':'')+'<span class="mt">'+hl(mini?(e.memo||'').slice(0,40):e.memo)+'</span></div>'}
function head(){var r=range(),a=pd(r[0]),b=pd(r[1]);
 if(view==='week')$('ops-rt').innerHTML='WEEK '+wno(anchor)+' · '+a.getFullYear()+'<b>'+(a.getMonth()+1)+'. '+a.getDate()+' – '+(b.getMonth()+1)+'. '+b.getDate()+'</b>';
 else if(view==='month'){var m=pd(anchor);$('ops-rt').innerHTML='MONTH<b>'+m.getFullYear()+'. '+(m.getMonth()+1)+'</b>'}
 else if(view==='done')$('ops-rt').innerHTML='ARCHIVE<b>지금까지 한 일</b>';
 else $('ops-rt').innerHTML='SEARCH<b>'+E(srchQ)+'</b>';
 [].forEach.call(document.querySelectorAll('[data-v]'),function(x){x.classList.toggle('on',x.getAttribute('data-v')===view)});
 var os=$('ops-owner'),names={};people.forEach(function(p){names[p.name]=1});items.forEach(function(e){if(e.owner)names[e.owner]=1});
 os.innerHTML='<option value="">담당자 전체</option>'+Object.keys(names).map(function(n){return '<option'+(n===ownerF?' selected':'')+'>'+E(n)+'</option>'}).join('');
 $('ops-legend').innerHTML=people.map(function(p){return '<button type="button" class="lgd'+(ownerF===p.name?' on':ownerF?' off':'')+'" data-own="'+E(p.name)+'"><i style="background:'+p.color+'"></i>'+E(p.name)+'</button>'}).join('')||'<button type="button" class="lgd" data-a="people">+ 사람·색 정하기</button>'}
function draw(){head();var v=$('ops-view');
 if(view==='week'){var by={},wm=[];items.filter(vis).forEach(function(e){if(e.kind==='wmemo'){if(e.day===anchor)wm.push(e);return}(by[e.day]=by[e.day]||[]).push(e)});
  var h='<div class="wk">';for(var i=0;i<7;i++){var d=addD(anchor,i),es=(by[d]||[]).sort(sortIt),dt=pd(d);
   h+='<div class="col'+(d===TODAY?' td':'')+(i>4?' we':'')+'" data-drop="'+d+'"><div class="ch"><span class="dn"><span class="f">'+EN[i]+'</span><span class="s">'+EN[i].slice(0,3)+'</span></span><span class="dk">'+KO[i]+'</span><span class="dnum">'+dt.getDate()+'</span></div><div class="cb">'
    +'<div class="grp">'+es.filter(function(e){return e.kind==='event'}).map(function(e){return itHtml(e)}).join('')+'</div>'
    +'<div class="grp">'+es.filter(function(e){return e.kind==='memo'}).map(function(e){return itHtml(e)}).join('')+'</div>'
    +'<div class="grp tks">'+es.filter(function(e){return e.kind==='task'}).map(function(e){return itHtml(e)}).join('')+'</div>'
    +'</div><button type="button" class="add" data-add="'+d+'">+ 추가</button></div>'}
  h+='</div>';
  var tk=items.filter(function(e){return e.kind==='task'&&vis(e)&&e.day>=anchor&&e.day<=addD(anchor,6)}).sort(sortIt);
  var dn=tk.filter(function(e){return e.status==='done'}),dg=tk.filter(function(e){return e.status==='doing'}),td=tk.filter(function(e){return e.status!=='done'&&e.status!=='doing'});
  // 밀린 일(이 주보다 앞 날짜인데 안 끝낸 것)은 이번 주·앞으로의 주를 볼 때 '남은 할 일'·'진행 중' 맨 위에 — 끌어서 날짜 칸에 넣는다
  var od=anchor>=monOf(TODAY)?overdue.filter(vis):[],odg=od.filter(function(e){return e.status==='doing'}),odt=od.filter(function(e){return e.status!=='doing'});
  function li(e,late){return '<li'+(late?' class="od"':'')+' data-id="'+E(e.id)+'" data-day="'+e.day+'" draggable="true" title="끌어서 날짜 칸에 놓으면 그날로 옮겨요"><span class="d">'+(late?'밀림 · ':'')+lab(e.day)+'</span>'+hl(e.title)+(e.owner?' <span class="pill" style="--oc:'+(pc(e.owner)||'#eee')+'">'+E(e.owner)+'</span>':'')+'</li>'}
  function box(t,en,l,empty,lt){var n=l.length+(lt?lt.length:0);return '<div><h3>'+t+' <small>'+en+'</small><b>'+n+'</b></h3>'+(n?(lt&&lt.length?'<p class="odh">'+(anchor===monOf(TODAY)?'지난주까지':'이 주 전에')+' 밀린 일 '+lt.length+'</p><ul>'+lt.map(function(e){return li(e,1)}).join('')+'</ul>'+(l.length?'<p class="odh" style="color:var(--sub)">이번 주</p>':''):'')+(l.length?'<ul>'+l.map(function(e){return li(e)}).join('')+'</ul>':''):'<p class="nm">'+empty+'</p>')+'</div>'}
  h+='<div class="sum">'+box('이번 주 완료','DONE',dn,'아직 없어요')+box('진행 중','IN PROGRESS',dg,'없어요',odg)+box((anchor<monOf(TODAY)?'못 한 일':'남은 할 일'),'TO DO',td,'없어요',odt)
   +'<div class="wm"><h3>이번 주 메모 <small>NOTES</small></h3>'+wm.map(function(e){return itHtml(e)}).join('')+'<button type="button" class="add" data-addw="1" style="border:0;padding-left:0">+ 주간 메모</button></div></div>';
  v.innerHTML=h}
 else if(view==='month'){var r=range(),m=pd(anchor).getMonth(),by2={};items.filter(vis).forEach(function(e){if(e.kind!=='wmemo')(by2[e.day]=by2[e.day]||[]).push(e)});
  var g='<div class="mon">'+KO.map(function(k,i){return '<div class="h">'+EN[i].slice(0,3)+' · '+k+'</div>'}).join(''),d=r[0];
  while(d<=r[1]){var es=(by2[d]||[]).sort(sortIt);g+='<div class="c'+(pd(d).getMonth()!==m?' out':'')+(d===TODAY?' td':'')+'" data-drop="'+d+'" data-go="'+d+'"><span class="n">'+pd(d).getDate()+'</span>'
    +es.slice(0,4).map(function(e){return itHtml(e,1)}).join('')+(es.length>4?'<span class="more">+'+(es.length-4)+'개</span>':'')
    +(es.length?'<span class="dots">'+es.slice(0,5).map(function(){return '<i></i>'}).join('')+'</span>':'')+'</div>';d=addD(d,1)}
  v.innerHTML=g+'</div><p class="foot">날짜를 누르면 그 주의 주간 보기로 가요.</p>'}}
// ── 지금까지 한 일 ──
var doneItems=[],doneNext='',doneTotal=0;
function loadDone(more){var had=!!code;return api('/admin/opscal/done'+(more&&doneNext?'?before='+doneNext:'')).then(function(j){if(denied(j,had))return;if(!j.ok){W.toast('불러오지 못했어요');return}
 enter(j);doneItems=more?doneItems.concat(j.items||[]):(j.items||[]);doneNext=j.next||'';doneTotal=j.total||0;drawDone()})}
function rowHtml(e,showKind){var K={event:'일정',task:'할 일',memo:'메모',wmemo:'주간'};return '<div class="r" data-id="'+E(e.id)+'" data-day="'+e.day+'" data-find="1"><span class="d">'+lab(e.day)+'</span>'+(showKind?'<span class="k">'+K[e.kind]+'</span>':'')
 +'<span class="x">'+(e.kind==='task'?(e.status==='done'?'● ':e.status==='doing'?'◐ ':'○ '):'')+hl(e.title||'')+(e.memo?'<div>'+hl(e.memo)+'</div>':'')+'</span>'+(e.owner?'<span class="pill" style="--oc:'+(pc(e.owner)||'#eee')+'">'+E(e.owner)+'</span>':'')+'</div>'}
function drawDone(){head();var g={},ks=[];doneItems.filter(vis).forEach(function(e){var k=monOf(e.day);if(!g[k]){g[k]=[];ks.push(k)}g[k].push(e)});
 $('ops-view').innerHTML='<div class="lst"><p class="m" style="margin:.8rem 0 0">완료한 할 일 모두 <b>'+doneTotal+'</b>건 — 주마다 묶었어요. <a href="#" data-a="back">← 주간 플래너로</a></p>'
  +(ks.length?ks.map(function(k){return '<h4>'+lab(k)+' – '+lab(addD(k,6))+' <small>WEEK '+wno(k)+' · '+g[k].length+'건</small></h4>'+g[k].map(function(e){return rowHtml(e)}).join('')}).join(''):'<p class="ops-empty">아직 완료한 일이 없어요.</p>')
  +(doneNext?'<p><button type="button" class="ib" data-a="donemore">더 보기</button></p>':'')+'</div>'}
// ── 검색 ──
var found=[];
function doSearch(){var had=!!code;return api('/admin/opscal/search?q='+encodeURIComponent(srchQ)).then(function(j){if(denied(j,had))return;found=j.items||[];head();
 $('ops-view').innerHTML='<div class="lst"><p class="m" style="margin:.8rem 0 0">\''+E(srchQ)+'\' 찾은 것 '+found.length+'개 '+(found.length>=100?'(최근 100개까지)':'')+' · <a href="#" data-a="back">← 주간 플래너로</a></p>'+(found.length?found.map(function(e){return rowHtml(e,1)}).join(''):'<p class="ops-empty">찾은 것이 없어요.</p>')+'</div>'})}
// ── 항목 창 ──
var ed=null,fk='event',fs='todo',lastF='f-title';
function setKind(k){fk=k;[].forEach.call(document.querySelectorAll('#f-kind [data-k]'),function(b){b.classList.toggle('on',b.getAttribute('data-k')===k)});
 $('f-ev').hidden=k!=='event';$('f-tk').hidden=k!=='task';$('f-ow').hidden=k==='wmemo';$('f-dl').textContent=k==='wmemo'?'그 주 (아무 날이나)':(k==='task'?'할 날 (마감)':'날짜');
 $('f-tl').textContent=k==='memo'||k==='wmemo'?'제목 (선택)':'제목';$('f-ml').textContent=k==='memo'||k==='wmemo'?'메모':'자세한 내용 (선택)';$('f-untilw').hidden=!$('f-rep').value}
function setSt(s){fs=s;[].forEach.call(document.querySelectorAll('#f-st [data-s]'),function(b){b.classList.toggle('on',b.getAttribute('data-s')===s)})}
function ownOpts(v){var names=people.map(function(p){return p.name});if(v&&names.indexOf(v)<0)names.push(v);$('f-owner').innerHTML='<option value="">담당자 없음</option>'+names.map(function(n){return '<option'+(n===v?' selected':'')+'>'+E(n)+'</option>'}).join('')}
function hlBar(){$('f-hl').innerHTML=people.length?'형광펜 '+people.map(function(p){return '<button type="button" data-hl="'+E(p.name)+'" style="background:'+p.color+'">'+E(p.name)+'</button>'}).join('')+'<button type="button" data-hl="" style="background:#fff">지우기</button><span>— 글자를 고른 뒤 이름을 누르세요</span>':'형광펜은 <a href="#" data-a="people">사람·색</a>을 먼저 정하면 쓸 수 있어요.'}
function pv(){$('f-tpv').innerHTML=/\{@/.test($('f-title').value)?hl($('f-title').value):'';$('f-mpv').innerHTML=/\{@/.test($('f-memo').value)?hl($('f-memo').value):'';grow()}
function openItem(e,day,kind){ed=e||null;$('f-h').textContent=e?'고치기':'추가';setKind(e?e.kind:(kind||'event'));setSt(e&&e.status?e.status:'todo');
 $('f-title').value=e?e.title:'';$('f-memo').value=e?e.memo:'';$('f-day').value=e?(e.series?e.baseDay:e.day):(day||TODAY);
 $('f-start').value=e?e.start:'';$('f-end').value=e?e.end:'';$('f-rep').value=e?e.repeat:'';$('f-until').value=e?e.until:'';$('f-untilw').hidden=!$('f-rep').value;
 ownOpts(e?e.owner:(ownerF||''));hlBar();pv();
 [].forEach.call(document.querySelectorAll('#f-kind [data-k]'),function(b){b.disabled=!!e&&((e.kind==='wmemo')!==(b.getAttribute('data-k')==='wmemo'))});
 $('f-del').hidden=!e;$('f-del').textContent=e&&e.series?'반복 전체 삭제':'삭제';$('f-del1').hidden=!(e&&e.series);$('f-endr').hidden=!(e&&e.series);$('f-err').hidden=true;
 var mt='';if(e){mt='만든 사람 '+(e.createdBy||'-')+' · '+new Date(e.created).toLocaleString('ko-KR');if(e.updated!==e.created)mt+='<br>고친 사람 '+(e.updatedBy||'-')+' · '+new Date(e.updated).toLocaleString('ko-KR');
  if(e.carried)mt+='<br>↪ '+lab(e.origDay||e.day)+'에서 넘어온 일 ('+e.carried+'주째)';if(e.series)mt+='<br>↻ 반복 일정 — 날짜·내용을 고치면 반복 전체가 바뀌어요(지금 연 날: '+lab(e.day)+')';if(e.kind==='task'&&e.doneAt)mt+='<br>● 완료 '+new Date(e.doneAt).toLocaleString('ko-KR')}
 $('f-meta').innerHTML=mt;$('dlg-item').hidden=false;grow();setTimeout(function(){$(fk==='memo'||fk==='wmemo'?'f-memo':'f-title').focus()},50)}
function closeDlg(){[].forEach.call(document.querySelectorAll('.dlg'),function(d){d.hidden=true});ed=null}
function ferr(m){var x=$('f-err');x.textContent=m;x.hidden=false}
function upsert(it){items=items.filter(function(x){return x.id!==it.id});overdue=overdue.filter(function(x){return x.id!==it.id});var r=range();if(!it.repeat&&it.day>=r[0]&&it.day<=r[1])items.push(it);
 else if(it.kind==='task'&&it.status!=='done'&&!it.repeat&&it.day<r[0]){overdue.push(it);overdue.sort(sortIt)}}
// 자세한 내용 칸은 글 길이만큼 늘어난다 — 스크롤 없이 다 보이게
function grow(){var t=$('f-memo');t.style.height='auto';t.style.height=(t.scrollHeight+2)+'px'}
$('f').addEventListener('submit',function(ev){ev.preventDefault();var b={id:ed?ed.id:'',kind:fk,title:$('f-title').value.trim(),memo:$('f-memo').value,day:$('f-day').value,owner:fk==='wmemo'?'':$('f-owner').value,
  start:fk==='event'?$('f-start').value:'',end:fk==='event'?$('f-end').value:'',repeat:fk==='event'?$('f-rep').value:'',until:fk==='event'&&$('f-rep').value?$('f-until').value:'',status:fk==='task'?fs:''};
 if(!b.day){ferr('날짜를 골라 주세요.');return}if(!b.title&&!(fk==='memo'||fk==='wmemo')){ferr('제목을 적어 주세요.');return}
 var sv=$('f-save');sv.disabled=true;post('/admin/opscal/save',b).then(function(j){sv.disabled=false;if(denied(j)){closeDlg();return}if(!j.ok){ferr(j.message||'저장하지 못했어요.');return}
  closeDlg();W.toast('저장했어요');if(j.item.repeat||(ed&&ed.series)){load();return}upsert(j.item);if(view==='week'||view==='month')draw();else load()}).catch(function(){sv.disabled=false;ferr('저장하지 못했어요.')})});
function del(only){if(!ed)return;var t=ed.title||'메모',e=ed;if(!confirm(only?("'"+t+"' 반복 일정에서 "+lab(e.day)+" 하루만 뺄까요?"):("'"+t+"'"+(e.series?' 반복 일정 전체를':'을(를)')+" 지울까요?\n지우면 되돌릴 수 없어요.")))return;
 post('/admin/opscal/delete',{id:e.id,day:e.day,only:only?1:0}).then(function(j){if(denied(j)){closeDlg();return}if(!j.ok){ferr('지우지 못했어요.');return}closeDlg();W.toast(only?'그날만 뺐어요':'지웠어요');
  if(e.series){load();return}items=items.filter(function(x){return x.id!==e.id});overdue=overdue.filter(function(x){return x.id!==e.id});if(view==='week'||view==='month')draw();else load()})}
$('f-del').addEventListener('click',function(){del(false)});$('f-del1').addEventListener('click',function(){del(true)});
// 반복 끝내기 — 오늘(지난 날을 열었으면) 또는 연 날부터 앞으로는 없애고, 그 전 것은 남긴다
$('f-endr').addEventListener('click',function(){if(!ed||!ed.series)return;var e=ed,f=e.day<TODAY?TODAY:e.day,t=e.title||'일정',all=f<=e.baseDay;
 if(!confirm(all?("'"+t+"'은(는) "+lab(f)+"에 처음 시작해서 남길 지난 일정이 없어요.\n반복 일정을 통째로 지울까요?"):("'"+t+"' 반복을 끝낼까요?\n"+lab(addD(f,-1))+"까지 지난 일정은 그대로 남고, "+lab(f)+"부터 앞으로는 없어져요.")))return;
 post('/admin/opscal/endrepeat',{id:e.id,from:f}).then(function(j){if(denied(j)){closeDlg();return}if(!j.ok){ferr(j.message||'끝내지 못했어요.');return}closeDlg();W.toast(j.removed?'지웠어요':lab(addD(f,-1))+'까지만 남기고 반복을 끝냈어요');load()}).catch(function(){ferr('끝내지 못했어요.')})});
$('f-kind').addEventListener('click',function(e){var b=e.target.closest('[data-k]');if(b&&!b.disabled)setKind(b.getAttribute('data-k'))});
$('f-st').addEventListener('click',function(e){var b=e.target.closest('[data-s]');if(b)setSt(b.getAttribute('data-s'))});
$('f-rep').addEventListener('change',function(){$('f-untilw').hidden=!this.value});
['f-title','f-memo'].forEach(function(id){$(id).addEventListener('focus',function(){lastF=id});$(id).addEventListener('input',pv)});
$('f-memo').addEventListener('input',grow);
$('f-hl').addEventListener('mousedown',function(e){if(e.target.closest('[data-hl]'))e.preventDefault()});
$('f-hl').addEventListener('click',function(e){var b=e.target.closest('[data-hl]');if(!b)return;var f=$(lastF),n=b.getAttribute('data-hl'),v=f.value,s=f.selectionStart,t=f.selectionEnd;
 if(!n){f.value=v.replace(/\{@[^|{}]{1,20}\|([^{}]*)\}/g,'$1');pv();f.focus();return}
 if(s==null||s===t){W.toast('칠할 글자를 먼저 골라 주세요');f.focus();return}
 var mid=v.slice(s,t).replace(/[{}]/g,'');f.value=v.slice(0,s)+'{@'+n+'|'+mid+'}'+v.slice(t);pv();f.focus();var c=s+n.length+3+mid.length+1;f.setSelectionRange(c,c)});
// ── 사람·색 ──
var pp=[];
function drawPpl(){$('ppl').innerHTML=pp.map(function(p,i){return '<div class="pr"><input class="in" type="text" maxlength="20" value="'+E(p.name)+'" data-pn="'+i+'" placeholder="이름">'+COLORS.map(function(c){return '<button type="button" class="sw'+(c===p.color?' on':'')+'" style="background:'+c+'" data-pc="'+i+'" data-c="'+c+'" aria-label="색 '+c+'"></button>'}).join('')+'<button type="button" class="ib del" data-px="'+i+'">빼기</button></div>'}).join('')||'<p class="nm">아직 정한 사람이 없어요.</p>'}
$('ppl').addEventListener('input',function(e){var i=e.target.getAttribute('data-pn');if(i!=null)pp[+i].name=e.target.value});
$('ppl').addEventListener('click',function(e){var c=e.target.closest('[data-pc]'),x=e.target.closest('[data-px]');if(c){pp[+c.getAttribute('data-pc')].color=c.getAttribute('data-c');drawPpl()}if(x){pp.splice(+x.getAttribute('data-px'),1);drawPpl()}});
$('ppl-add').addEventListener('click',function(){var used={};pp.forEach(function(p){used[p.color]=1});var c=COLORS.filter(function(x){return!used[x]})[0]||COLORS[0];pp.push({name:'',color:c});drawPpl();var ins=document.querySelectorAll('#ppl input');if(ins.length)ins[ins.length-1].focus()});
$('ppl-save').addEventListener('click',function(){var b=this;b.disabled=true;post('/admin/opscal/people',{people:pp.filter(function(p){return p.name.trim()})}).then(function(j){b.disabled=false;if(denied(j)){closeDlg();return}if(!j.ok){W.toast('저장하지 못했어요');return}people=j.people||[];closeDlg();W.toast('저장했어요');if(view==='done')drawDone();else if(view==='search')doSearch();else draw()})});
// ── 주간 마감 보고 (메일 모양 미리보기 — 보내지는 않는다) ──
function openMail(){var cur=monOf(TODAY),opts=[];for(var i=-1;i<=4;i++){var w=addD(cur,-7*i);opts.push('<option value="'+w+'">'+(i===0?'이번 주':i===1?'지난주':i===-1?'다음 주':i+'주 전')+' · '+lab(w)+' – '+lab(addD(w,6))+'</option>')}
 $('mail-week').innerHTML=opts.join('');$('mail-week').value=view==='week'?anchor:addD(cur,-7);if(!$('mail-week').value)$('mail-week').value=addD(cur,-7);$('dlg-mail').hidden=false;loadMail()}
function loadMail(){var had=!!code;$('mail-info').textContent='불러오는 중…';api('/admin/opscal/weekly?week='+$('mail-week').value).then(function(j){if(denied(j,had)){closeDlg();return}if(!j.ok){$('mail-info').textContent='불러오지 못했어요.';return}
 $('mail-fr').srcdoc=j.html;$('mail-info').innerHTML='제목: <b>'+E(j.subject)+'</b><br>그 주에 한 일·못 한 일·앞으로 할 일을 한 장으로 묶었어요.'})}
$('mail-week').addEventListener('change',loadMail);
// ── 클릭 ──
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDlg()});
[].forEach.call(document.querySelectorAll('.dlg'),function(d){d.addEventListener('click',function(e){if(e.target===d||e.target.closest('[data-close]'))closeDlg()})});
function find(id,day){for(var i=0;i<items.length;i++)if(items[i].id===id&&(!day||items[i].day===day))return items[i];for(i=0;i<overdue.length;i++)if(overdue[i].id===id)return overdue[i];for(i=0;i<found.length;i++)if(found[i].id===id)return found[i];for(i=0;i<doneItems.length;i++)if(doneItems[i].id===id)return doneItems[i];return null}
$('ops').addEventListener('click',function(e){
 var a=e.target.closest('[data-a]'),v=e.target.closest('[data-v]'),ck=e.target.closest('[data-st]'),it=e.target.closest('[data-id]'),ad=e.target.closest('[data-add]'),ow=e.target.closest('[data-own]'),go=e.target.closest('[data-go]');
 if(e.target.closest('.dlg'))return;
 if(a){e.preventDefault();var k=a.getAttribute('data-a');
  if(k==='prev'||k==='next'){var s=k==='prev'?-1:1;if(view==='month'){var m=pd(anchor);anchor=ymd(new Date(m.getFullYear(),m.getMonth()+s,1))}else anchor=addD(anchor,7*s);load()}
  else if(k==='today'){anchor=view==='month'?ymd(new Date(pd(TODAY).getFullYear(),pd(TODAY).getMonth(),1)):monOf(TODAY);if(view!=='month')view='week';load()}
  else if(k==='add')openItem(null,view==='week'&&!(TODAY>=anchor&&TODAY<=addD(anchor,6))?anchor:TODAY,'event');
  else if(k==='people'){pp=people.map(function(p){return{name:p.name,color:p.color}});drawPpl();$('dlg-ppl').hidden=false}
  else if(k==='done'){view='done';history.replaceState(null,'','?view=done');load()}
  else if(k==='donemore')loadDone(true);
  else if(k==='back'){view='week';anchor=monOf(TODAY);history.replaceState(null,'',location.pathname);load()}
  else if(k==='mail')openMail();
  else if(k==='print'){if(view!=='week'&&view!=='month'){view='week';load().then(function(){setTimeout(function(){window.print()},300)})}else window.print()}
  else if(k==='carry'){if(!confirm('지난주까지 끝내지 못한 할 일을 모두 이번 주 월요일 칸으로 옮길까요?\n(매주 월요일 아침에는 저절로 해요)'))return;post('/admin/opscal/carry',{}).then(function(j){if(denied(j))return;W.toast(j.ok?(j.moved?j.moved+'개를 이번 주로 옮겼어요':'옮길 일이 없어요'):'옮기지 못했어요');if(j.ok&&j.moved){anchor=monOf(TODAY);view='week';load()}})}
  else if(k==='sync')W.openSync();
  return}
 if(v){var nv=v.getAttribute('data-v');if(nv===view)return;if(nv==='month'){var x=pd(view==='week'?addD(anchor,3):anchor);anchor=ymd(new Date(x.getFullYear(),x.getMonth(),1))}else{var y=pd(anchor);anchor=monOf(view==='month'?(TODAY.slice(0,7)===anchor.slice(0,7)?TODAY:anchor):anchor)}view=nv;if(location.search)history.replaceState(null,'',location.pathname);load();return}
 if(ow){var n=ow.getAttribute('data-own');ownerF=ownerF===n?'':n;if(view==='done')drawDone();else draw();return}
 if(ck){e.stopPropagation();var t=find(ck.getAttribute('data-st'));if(!t)return;var nx=t.status==='todo'||!t.status?'doing':t.status==='doing'?'done':'todo',old=t.status;
  items.forEach(function(z){if(z.id===t.id){z.status=nx;z.doneAt=nx==='done'?Date.now():0}});draw();
  post('/admin/opscal/status',{id:t.id,status:nx}).then(function(j){if(denied(j))return;if(!j.ok){items.forEach(function(z){if(z.id===t.id)z.status=old});draw();W.toast(j.message||'바꾸지 못했어요');return}
   if(nx==='done')W.toast('완료 ✓')}).catch(function(){items.forEach(function(z){if(z.id===t.id)z.status=old});draw();W.toast('바꾸지 못했어요')});return}
 if(it){var f=find(it.getAttribute('data-id'),it.getAttribute('data-day'));if(f)openItem(f);return}
 if(ad){openItem(null,ad.getAttribute('data-add'),'task');return}
 if(e.target.closest('[data-addw]')){openItem(null,anchor,'wmemo');return}
 if(go&&view==='month'){anchor=monOf(go.getAttribute('data-go'));view='week';load();return}});
$('ops-owner').addEventListener('change',function(){ownerF=this.value;if(view==='done')drawDone();else draw()});
$('ops-q').addEventListener('keydown',function(e){if(e.key!=='Enter')return;var q=this.value.trim();if(!q){if(view==='search'){view='week';load()}return}srchQ=q;view='search';doSearch()});
// ── 끌어 옮기기 (PC) ──
$('ops').addEventListener('dragstart',function(e){var t=e.target.closest&&e.target.closest('[draggable=true][data-id]');if(!t)return;dragId=t.getAttribute('data-id');try{e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move'}catch(x){}});
$('ops').addEventListener('dragover',function(e){var z=e.target.closest&&e.target.closest('[data-drop]');if(!z||!dragId)return;e.preventDefault();[].forEach.call(document.querySelectorAll('.drop'),function(x){if(x!==z)x.classList.remove('drop')});z.classList.add('drop')});
$('ops').addEventListener('dragleave',function(e){var z=e.target.closest&&e.target.closest('[data-drop]');if(z&&!z.contains(e.relatedTarget))z.classList.remove('drop')});
$('ops').addEventListener('dragend',function(){dragId='';[].forEach.call(document.querySelectorAll('.drop'),function(x){x.classList.remove('drop')})});
$('ops').addEventListener('drop',function(e){var z=e.target.closest&&e.target.closest('[data-drop]');if(!z||!dragId)return;e.preventDefault();z.classList.remove('drop');
 var id=dragId,day=z.getAttribute('data-drop'),t=find(id);dragId='';if(!t||t.day===day)return;var old=t.day,od0=overdue.indexOf(t)>=0;
 function back(){t.day=old;if(od0){items=items.filter(function(x){return x!==t});if(overdue.indexOf(t)<0){overdue.push(t);overdue.sort(sortIt)}}draw()}
 t.day=day;if(od0){overdue=overdue.filter(function(x){return x!==t});items.push(t)}draw();
 post('/admin/opscal/move',{id:id,day:day}).then(function(j){if(denied(j))return;if(!j.ok){back();W.toast(j.message||'옮기지 못했어요');return}upsert(j.item);draw();W.toast(lab(day)+'로 옮겼어요')}).catch(function(){back();W.toast('옮기지 못했어요')})});
// ── 시작 — 로그인 없이 바로. 동기화로 내용이 바뀌면 app.js 가 W.redraw() 를 부른다 ──
W.redraw=function(){return load()};
load();
})();
