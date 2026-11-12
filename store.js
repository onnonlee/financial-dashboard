// 비공개 페이지 저장소: 앱 데이터를 이 페이지의 저장소(money/state)에 두어
// 폰·컴퓨터가 같은 숫자를 보고, Claude도 대화에서 바로 고칠 수 있게 함.
(function () {
  let ref = null, timer = null, pending = null, lastRev = 0, onRemote = null, ready = false;
  function write() {
    if (!ref || !ready || !pending) return;
    const rev = Date.now(); lastRev = rev;
    ref.set({ json: JSON.stringify(pending), rev: rev, by: 'app' }).catch(function () {});
  }
  window.MoneyStore = {
    init: function (cb) {
      onRemote = cb;
      if (!window.claude || !window.claude.use) return;
      window.claude.use('db').then(function (db) {
        if (!db) return;
        ref = db.doc('money/state');
        ref.onSnapshot(function (s) {
          // 처음 받은 내용이 먼저: 저장소에 데이터가 있으면 이 기기의 예전 내용으로 덮어쓰지 않음
          if (!ready) { ready = true; if (s.exists) pending = null; else if (pending) write(); }
          if (!s.exists || s.metadata.hasPendingWrites) return;
          const v = s.data(); if (!v || typeof v.json !== 'string') return;
          if (v.rev && v.rev === lastRev) return;
          lastRev = v.rev || 0;
          try { onRemote(JSON.parse(v.json)); } catch (e) { /* 읽을 수 없는 내용은 건너뜀 */ }
        }, function () {});
      });
    },
    push: function (S) { pending = S; clearTimeout(timer); timer = setTimeout(write, 700); }
  };
})();
