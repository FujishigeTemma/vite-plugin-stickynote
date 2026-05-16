# `packages/vue` 改善 TODO

`PLAN.md` の設計原則（シンプルさ最優先 / YAGNI / 過剰な抽象化を避ける / composable over configuration）を踏まえ、**よりクリーンかつシンプルに**することを目的にした修正リスト。各項目に DevTools / `vite-plugin-vue-inspector` の参照箇所を併記する。

---

## 実施する

### 1. `mount()` を冪等化し、`unmount()` を返す

**現状:** `runtime/overlay.ts:6,11-36` — モジュール `let mounted = false`。HMR でモジュール再評価すると `mounted` がリセットされる一方、前回の `<div id="stickynote-overlay-root">` と Vue アプリ・リスナーは残存する → 二重マウント。

**改善:**

- `mount()` 冒頭で `document.getElementById('stickynote-overlay-root')` を探し、既存があれば teardown して新規作成。
- `mount()` が `{ unmount }` を返す。

**参考:** DevTools `component-highlighter/index.ts:190-216` の `cancelInspectComponentHighLighter` パターン。

---

### 2. クリーンアップを `mount()` の `unmount()` に集約

**現状:** リスナー / 観測器 / history パッチ / グローバルが `App.vue` / `Inspector.vue` / `cache.ts` / `state.ts` の4箇所に散在し、teardown が不完全。

**改善:** `mount()` から返る `unmount()` が以下を一括で破棄：

- Vue app の `unmount()`
- Shadow ホスト要素 `.remove()`
- `cache.stop()` を呼ぶ
- history パッチを巻き戻す（項目3）
- `window.__STICKYNOTE__` を `delete`
- ハイライト DOM 削除（`highlight.ts` の cleanup）

`App.vue` の `onBeforeUnmount` も無用になるため、ロジック自体を `mount()` 側に寄せる。

**参考:** DevTools の単一 cancel 関数パターン。

---

### 3. ルート追跡を vue-router に寄せ、history パッチを撤去

**現状:** `state.ts:182-203` が `history.pushState/replaceState` を **永続的に** 上書きし teardown なし。HMR ごとに wrapper が入れ子に。さらに `currentRoute = window.location.pathname` で **PLAN §7.3 のルートパターン共有（`/users/:id`）が機能していない**。

**改善:**

- vue-router がアプリにいる場合（`appContext.config.globalProperties.$router` 経由で取得）、`router.currentRoute` を watch して `route` / `url` を取得。
- `matched[matched.length-1]?.path` をルートパターン、`currentRoute.value.fullPath` を url として保存。
- vue-router 不在時のみフォールバックとして `popstate` を listen（pushState パッチはやめる）。

**参考:** DevTools `devtools-kit/src/core/router/index.ts:47-72`。

**スペック対応:** PLAN §7.3 のクロス URL 共有を成立させる必須項目。

---

### 4. キーイング不整合を解消（`path:line:col` vs `path:line`）

**現状:** `inspector-transform.ts:51-52` は `data-v-inspector="path:line:col"` を埋め込み、`inspector.ts:53-61` の `findOccurrenceIndex` も `[ATTR="path:line:col"]` で照会。一方 `buildElementMap` (`inspector.ts:68-82`) は **col を捨てて `path:line` をキー** に集計 → 二つの population が別物になり pin が漂流する。

**改善:**

- transform 側で **col の埋め込みをやめ**、`data-v-inspector="path:line"` に統一。
- `parseInspector` / `findOccurrenceIndex` / `buildElementMap` の3者を全部 `path:line` に揃える。
- `findElementInMap` の **`?? matches[0]` フォールバックを撤去** し、`matches[index] ?? null` のみ。これで `isThreadStale` が PLAN §7.1 通りに機能する。

**参考:** DevTools には類似機能なし。内部整合性の問題なので「片方に寄せる」で解決。シンプルな方（col なし）を採る。

---

### 5. `data-stickynote-ignore` 属性で in-overlay 判定

**現状:** `Inspector.vue:50-52` `eventInOverlay` が host id 文字列 `"stickynote-overlay-root"` に依存。

**改善:**

- Shadow ホスト要素および highlight container に `data-stickynote-ignore` 属性を付与。
- `eventInOverlay` を `e.composedPath().some(n => n instanceof Element && n.hasAttribute?.('data-stickynote-ignore'))` に書き換え。

**参考:** vue-inspector `Overlay.vue:7,162` の `KEY_IGNORE` パターン。

---

### 6. `e.repeat` ガードと修飾キー読み取りの整理

**現状:** `Inspector.vue:123-127` の `onKey` が `altDepth` をキーリピートのたびにインクリメント → 押しっぱなしで親階層を一気に駆け上がる。

**改善:**

- `if (e.repeat) return` を `onKey` 冒頭に追加。
- `shiftHeld` の手動ステート管理をやめ、ハンドラ内で `e.shiftKey` / `e.altKey` を直接読む（最もシンプル）。

**参考:** vue-inspector `Overlay.vue:130`。

---

### 7. クリック intercept を `stopImmediatePropagation` まで含める

**現状:** `Inspector.vue:140` は `preventDefault + stopPropagation` のみ。host アプリが同じ capture phase の document listener を持っているとそちらに伝播する。

**改善:** `e.stopImmediatePropagation()` を追加（in-overlay の早期 return 後）。

**参考:** DevTools / vue-inspector いずれも3点セット。

---

### 8. スクロール / リサイズで highlight を閉じる

**現状:** `cache.ts` の `tick` は更新されるが、`Inspector.vue` の highlight 表示はそれを watch していないため、スクロール中もハイライトの矩形が残骸として残る。

**改善:** `Inspector.vue` で `tick` を inject して watch し、`hideHighlight()` ＋ `lastEvent = null` する。

**参考:** DevTools 流儀「resize で closeOverlay」（`Overlay.vue:121`）。シンプルで挙動が予測しやすい。

---

### 9. `instanceName` のカスケード拡張

**現状:** `vue-instance.ts:41-51` は `__name` → `name` → `__file` basename → `"Anonymous"`。グローバル / ローカル登録された名前なしコンポーネントが "Anonymous" になる。

**改善:** `__file` の後に親 / アプリの `appContext.components` レジストリ走査を追加する。
**キャッシュ（WeakMap）は入れない:** 過剰最適化。`mouseover` 頻度なら実測すれば不要なはず（YAGNI）。

**参考:** DevTools `component/utils/index.ts:78-99` の `getInstanceName` cascade。

---

### 10. mouseout の特殊処理を撤去

**現状:** `Inspector.vue:115-121` の `onMouseOut` が `relatedTarget == null` の時だけ消す。iframe や Shadow DOM 境界で残骸が残る原因。

**改善:** `onMouseOut` ハンドラを削除。`onMouseOver` で `pickInstance` が `null` を返した時に `hideHighlight()` する分岐を残せば十分。

**参考:** vue-inspector `Overlay.vue:215` の `closeOverlay` ロジック。

---

## 見送る（理由つき）

### S1. `toggleComboKey` オプション追加（DevTools/vue-inspector の `meta-shift`/`control-shift` 風）

**理由:** PLAN §8 は「**単一のキーバインドのみ**」を明示しており、設計原則も YAGNI を優先。現状 `Cmd/Ctrl + .` で動いており、コンフリクト報告がない段階で設定軸を増やすのは過剰。コンフリクトが顕在化したら定数値を変えるだけで足りる。

### S2. `appendTo` オプション追加（非 HTML エントリ用）

**理由:** Nuxt や SSR 用カスタマイズ。社内 dev 環境（Vite + Vue SPA）に閉じているため利用シナリオがない。YAGNI。

### S3. `instanceName` 結果の `WeakMap` キャッシュ

**理由:** 純粋な perf 最適化。`mouseover` は `mousemove` ではなく既に発火頻度が低く、コンポーネント名取得自体が O(1)〜O(短い親チェーン)。**早すぎる最適化を避ける**原則。

### S4. `pickInstance` の rAF コアレッシング

**理由:** PLAN §7.9 が rAF を要求しているのは `mousemove`。現状は `mouseover` で発火頻度が桁違いに低く、実害が出ていない。プロファイル後に判断する。**早すぎる最適化を避ける**。

### S5. `MutationObserver` の partial update（差分ベース）

**理由:** 同上。元の問題提起もスメル B1-#8 にとどまり、計測根拠なし。`rAF` で coalesce 済みなので現状で実害が出ていない。

### S6. Pin の per-element 監視（IntersectionObserver / ResizeObserver）

**理由:** 純粋な perf 最適化。コードがむしろ複雑化する（共通 `tick` watch のシンプルさを失う）。設計原則「シンプルさ最優先」に反する。

### S7. `composedPath()` を `pickInstance` のルート選定にも適用（host 側 Shadow DOM 越し対応）

**理由:** 前方互換のための YAGNI。現状の host アプリは Shadow DOM 不使用。

### S8. Escape ハンドラの `App.vue` 集約

**理由:** 現状 `Inspector.vue` 側に閉じており、`v-if="active"` で必ずマウントされるため動作する。move 自体は「責務分離」だが、現状の単純さを崩してまでやる利得が薄い。

### S9. `useElementMap()` / `useTick()` composable 化

**理由:** 利用箇所が3-4ヶ所と少なく、`inject(KEY)` 直書きの方が読みやすい。**過剰な抽象化を避ける**。
