/**
 * 智谱清言适配器（chatglm.cn）
 * 支持页面：/main/alltoolsdetail, /main/detail, / 等
 *
 * 选择器于 2026-10 实测验证：
 * - 输入框：#search-input-box textarea, .search-container textarea, .input-box textarea, textarea
 * - 回答块：.detail .item .answer .markdown-body, .detail .item:last-child .answer, .answer .markdown-body
 * - 发送按钮：.enter-btn, [class*="enter-btn"], #search-input-box .enter-btn
 * - 思考态/生成中指示器：.printing, [class*="printing"], .stop-answer-default, [class*="stop-answer"]
 */
(() => {
  const { wire, sleep, normalizeText, readInputDefault } = window.__WEBAGENTS__;

  const ADAPTER = {
    site: 'chatglm',
    input: '#search-input-box textarea, .search-container textarea, .input-box textarea, textarea',
    answerList: [
      '.detail .item:last-child .answer-content-wrap:not(.text-advance-thinking-content) .markdown-body',
      '.detail .item .answer-content-wrap:not(.text-advance-thinking-content) .markdown-body',
      '.detail .item:last-child .answer .markdown-body:not(.dr_margin_botttom)',
      '.detail .item .answer .markdown-body:not(.dr_margin_botttom)',
      '.detail .item:last-child .answer .markdown-body',
      '.detail .item .answer .markdown-body',
    ],
    thinkingSel: [
      '.printing',
      '[class*="printing"]',
      '.stop-answer-default',
      '[class*="stop-answer"]',
      '.stop-answer',
    ],

    /** 状态判定：生成中 / 深度思考中（避免常驻思考盒误判） */
    feedback() {
      // 1. 生成中 / 停止按钮
      const stopBtn = document.querySelector('.stop-answer-default, [class*="stop-answer"], .stop-answer, .printing, [class*="printing"]');
      if (stopBtn && (stopBtn.offsetParent !== null || stopBtn.getClientRects().length > 0)) return 'stop-answer';
      // 2. 深度思考中（存在思考状态条且尚未标记 done）
      const thinking = document.querySelector('.advance-thinking-status');
      if (thinking && (thinking.offsetParent !== null || thinking.getClientRects().length > 0)) {
        const done = thinking.querySelector('.advance-thinking-done') || thinking.classList.contains('advance-thinking-done');
        if (!done) return 'advance-thinking';
      }
      return null;
    },

    /**
     * 对话选项开关（智谱清言支持深度思考 / 联网搜索）：
     * - options: { deepThink?: boolean, search?: boolean }
     */
    async setOptions(opts, _inputEl) {
      const want = [
        ['deepThink', /深度思考|思考/],
        ['search', /联网搜索|联网|搜索/],
      ];
      for (const [key, re] of want) {
        if (opts[key] === undefined) continue;
        const btn = [...document.querySelectorAll('button, [role="button"], .toggle, [class*="toggle"], [class*="btn"]')].find((b) => {
          const txt = (b.innerText || '').trim();
          return re.test(txt) && txt.length <= 10 && b.offsetParent !== null;
        });
        if (!btn) continue;
        const cls = String(btn.className || '');
        const isOn = cls.includes('active') || cls.includes('selected') || cls.includes('on') || btn.getAttribute('aria-pressed') === 'true';
        if (isOn !== !!opts[key]) {
          btn.click();
          await sleep(300);
        }
      }
    },

    /** 供 state 轮询回传当前开关状态 */
    optionState() {
      const read = (re) => {
        const btn = [...document.querySelectorAll('button, [role="button"], .toggle, [class*="toggle"], [class*="btn"]')].find((b) => {
          const txt = (b.innerText || '').trim();
          return re.test(txt) && txt.length <= 10 && b.offsetParent !== null;
        });
        if (!btn) return null;
        const cls = String(btn.className || '');
        return cls.includes('active') || cls.includes('selected') || cls.includes('on') || btn.getAttribute('aria-pressed') === 'true';
      };
      return { deepThink: read(/深度思考|思考/), search: read(/联网搜索|联网|搜索/) };
    },

    async send(inputEl) {
      const cleared = () => {
        const live = document.querySelector('#search-input-box textarea, .search-container textarea, textarea') || inputEl;
        return !normalizeText(readInputDefault(live));
      };

      // 1. 尝试点击发送按钮（.enter-btn 系列）
      const btn = document.querySelector('#search-input-box .enter-btn, .search-container .enter-btn, .enter-btn, [class*="enter-btn"], button[class*="enter"]');
      if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
        btn.click();
        for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
          btn.dispatchEvent(t.startsWith('pointer')
            ? new PointerEvent(t, { bubbles: true, cancelable: true, view: window, pointerType: 'mouse' })
            : new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
        }
        await sleep(600);
        if (cleared()) return 'click';
      }

      // 2. 回退 Enter 键发送
      inputEl.focus();
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      await sleep(600);
      return cleared() ? (btn ? 'click-failed+enter' : 'enter') : 'none';
    },
  };

  wire(ADAPTER);
})();
